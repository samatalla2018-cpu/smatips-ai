// اختبارات أولوية 2: التفويض (authorization) يفشل بأمان (fail-closed)، ويُطبَّق من الخادم
// بغض النظر عن الواجهة. الدفع أصبح لكل رحلة (trip_id) وليس اشتراكًا عامًا للهاتف: عرض/إنشاء
// رحلاتك يحتاج مصادقة فقط، أما قراءة/تنزيل رحلة معيّنة فيحتاج أن تكون تلك الرحلة تحديدًا
// مدفوعة (payment_status='paid') — الملكية وحدها لا تكفي، ولا يوجد أي تجاوز لأي رقم هاتف.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/_utils.js';
import { onRequestGet as listTrips, onRequestPost as createTrip } from '../functions/api/trips/index.js';
import { onRequestGet as getTrip, onRequestPut as putTrip } from '../functions/api/trips/[id].js';
import { onRequestGet as subscriptionStatus } from '../functions/api/subscription/status.js';
import { createFakeD1 } from './helpers/fakeD1.mjs';

const SECRET = 'test-session-secret';

function reqWithCookie(url, token, init = {}) {
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Cookie', `smatrips_session=${encodeURIComponent(token)}`);
  return new Request(url, { ...init, headers });
}

async function ensureUser(db, phone) {
  await db.prepare('INSERT OR IGNORE INTO users (phone, created_at) VALUES (?, ?)').bind(phone, Date.now()).run();
}

// يحاكي ما يفعله الويبهوك فعليًا بعد تأكيد Moyasar للدفع (functions/api/payment/webhook.js) —
// يُستخدم هنا مباشرة على القاعدة بدل استدعاء الويبهوك الحقيقي، لأن اختبارات دورة حياة الدفع
// نفسها (التوقيع، إعادة التحقق من Moyasar، منع التزوير) موجودة في tests/payment.test.mjs.
async function markTripPaid(db, tripId) {
  await db.prepare("UPDATE trips SET payment_status = 'paid', paid_at = ? WHERE id = ?").bind(Date.now(), tripId).run();
}

test('trips API: no session cookie -> 401, never leaks data', async () => {
  const db = createFakeD1();
  const res = await listTrips({ request: reqWithCookie('https://smatrips.ai/api/trips', null), env: { SESSION_SECRET: SECRET, DB: db } });
  assert.equal(res.status, 401);
});

test('trips API: any authenticated session can list/create trips — payment is per-trip now, not a site-wide gate', async () => {
  const db = createFakeD1();
  await ensureUser(db, '0555111111');
  const token = await createSessionToken(SECRET, '0555111111');
  const env = { SESSION_SECRET: SECRET, DB: db };

  const createRes = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'رحلتي لدبي' }),
    }),
    env,
  });
  assert.equal(createRes.status, 200);

  const listRes = await listTrips({ request: reqWithCookie('https://smatrips.ai/api/trips', token), env });
  assert.equal(listRes.status, 200);
  const body = await listRes.json();
  assert.equal(body.trips.length, 1);
});

// TEST 1/2 من الطلب: كل رحلة جديدة لنفس المستخدم تحصل على trip_id مختلف ومستقل.
test('trips API: creating two trips for the same user yields two distinct, independently-unpaid trip_ids', async () => {
  const db = createFakeD1();
  await ensureUser(db, '0555999001');
  const token = await createSessionToken(SECRET, '0555999001');
  const env = { SESSION_SECRET: SECRET, DB: db };
  const create = (title) => createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    }),
    env,
  });

  const { trip: tripA } = await (await create('إسطنبول')).json();
  const { trip: tripB } = await (await create('دبي')).json();

  assert.notEqual(tripA.id, tripB.id, 'each new trip must get its own independent trip_id');
  assert.equal(tripA.payment_status, 'pending');
  assert.equal(tripB.payment_status, 'pending');
});

// TEST 9 من الطلب: أي payment_status/paid مُرسَل من الواجهة يُتجاهل — الخادم هو من يقرر.
test('trips API: a client-supplied payment_status/paid field on create is ignored', async () => {
  const db = createFakeD1();
  await ensureUser(db, '0555999002');
  const token = await createSessionToken(SECRET, '0555999002');
  const env = { SESSION_SECRET: SECRET, DB: db };

  const res = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'رحلة مزوّرة', payment_status: 'paid', paid: true }),
    }),
    env,
  });
  const { trip } = await res.json();
  assert.equal(trip.payment_status, 'pending', 'the server must always decide payment_status itself, never trust the request body');
});

// TEST 4 من الطلب: محاولة فتح رحلة غير مدفوعة تبقى مرفوضة، حتى لصاحبها.
test('trips API: reading your own trip before it is paid is rejected (403)', async () => {
  const db = createFakeD1();
  await ensureUser(db, '0555333333');
  const token = await createSessionToken(SECRET, '0555333333');
  const env = { SESSION_SECRET: SECRET, DB: db };

  const createRes = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'خاص', html: '<html>secret trip</html>' }),
    }),
    env,
  });
  const { trip } = await createRes.json();

  const res = await getTrip({
    request: reqWithCookie(`https://smatrips.ai/api/trips/${trip.id}`, token),
    env, params: { id: trip.id },
  });
  assert.equal(res.status, 403, 'an unpaid trip must stay locked, even for its owner');
});

// TEST 5/7 من الطلب: بعد الدفع (محاكاة ما يفعله الويبهوك)، صاحب الرحلة يقرأها، ومستخدم آخر لا يستطيع
// — تغيير trip_id يدويًا في الطلب لا يفتح رحلة مستخدم آخر.
test('trips API: a paid trip is readable by its owner but not by another authenticated user', async () => {
  const db = createFakeD1();
  await ensureUser(db, '0555333333');
  await ensureUser(db, '0555444444');
  const ownerToken = await createSessionToken(SECRET, '0555333333');
  const attackerToken = await createSessionToken(SECRET, '0555444444');
  const env = { SESSION_SECRET: SECRET, DB: db };

  const createRes = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', ownerToken, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'خاص', html: '<html>secret trip</html>' }),
    }),
    env,
  });
  const { trip } = await createRes.json();
  await markTripPaid(db, trip.id);

  const attackerRes = await getTrip({
    request: reqWithCookie(`https://smatrips.ai/api/trips/${trip.id}`, attackerToken),
    env, params: { id: trip.id },
  });
  assert.equal(attackerRes.status, 403, 'another authenticated user must not be able to read this trip file, paid or not');

  const ownerRes = await getTrip({
    request: reqWithCookie(`https://smatrips.ai/api/trips/${trip.id}`, ownerToken),
    env, params: { id: trip.id },
  });
  assert.equal(ownerRes.status, 200);
});

// TEST 8 من الطلب: رحلة جديدة بعد رحلة مدفوعة لا تستفيد تلقائيًا من ذلك الدفع.
test('trips API: paying for one trip does not unlock a second, separate trip for the same user', async () => {
  const db = createFakeD1();
  await ensureUser(db, '0555999003');
  const token = await createSessionToken(SECRET, '0555999003');
  const env = { SESSION_SECRET: SECRET, DB: db };
  const create = (title) => createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, html: '<html>x</html>' }),
    }),
    env,
  });

  const { trip: paidTrip } = await (await create('إسطنبول')).json();
  await markTripPaid(db, paidTrip.id);
  const { trip: newTrip } = await (await create('دبي')).json();

  const newTripRes = await getTrip({
    request: reqWithCookie(`https://smatrips.ai/api/trips/${newTrip.id}`, token),
    env, params: { id: newTrip.id },
  });
  assert.equal(newTripRes.status, 403, 'a brand-new trip must never inherit an older, unrelated paid trip');

  const paidTripRes = await getTrip({
    request: reqWithCookie(`https://smatrips.ai/api/trips/${paidTrip.id}`, token),
    env, params: { id: paidTrip.id },
  });
  assert.equal(paidTripRes.status, 200, 'the already-paid trip must remain reachable');
});

// حفظ محتوى رحلتك الخاصة (PUT) يبقى مجانيًا دائمًا — الدفع يفتح القراءة/التنزيل فقط، وليس الحفظ.
test('trips API: saving your own trip content (PUT) works even before paying', async () => {
  const db = createFakeD1();
  await ensureUser(db, '0555999004');
  const token = await createSessionToken(SECRET, '0555999004');
  const env = { SESSION_SECRET: SECRET, DB: db };

  const createRes = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'مسودة' }),
    }),
    env,
  });
  const { trip } = await createRes.json();

  const putRes = await putTrip({
    request: reqWithCookie(`https://smatrips.ai/api/trips/${trip.id}`, token, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'مسودة محدّثة', html: '<html>updated</html>' }),
    }),
    env, params: { id: trip.id },
  });
  assert.equal(putRes.status, 200, 'saving a draft must not require payment');

  const otherToken = await createSessionToken(SECRET, '0555999005');
  const otherPutRes = await putTrip({
    request: reqWithCookie(`https://smatrips.ai/api/trips/${trip.id}`, otherToken, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'استيلاء', html: '<html>hijack</html>' }),
    }),
    env, params: { id: trip.id },
  });
  assert.equal(otherPutRes.status, 403, 'another user must not be able to overwrite someone else\'s trip content');
});

test('trips API: forged/tampered session cookie is rejected, not treated as authenticated', async () => {
  const db = createFakeD1();
  const res = await listTrips({
    request: reqWithCookie('https://smatrips.ai/api/trips', 'ZmFrZQ==.notarealsignature'),
    env: { SESSION_SECRET: SECRET, DB: db },
  });
  assert.equal(res.status, 401);
});

// html أصبح اختياريًا عند الإنشاء (يسمح بحجز trip_id مبكرًا قبل وجود محتوى نهائي) — القيمة
// الافتراضية '' فقط، بلا رفض. الرفض (400) الآن مخصص فقط لقيمة html من نوع غير صحيح.
test('trips API: creating a trip without html mints an empty, unpaid trip (not rejected)', async () => {
  const db = createFakeD1();
  await ensureUser(db, '0555777777');
  const token = await createSessionToken(SECRET, '0555777777');
  const env = { SESSION_SECRET: SECRET, DB: db };

  const res = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'رحلة بلا محتوى بعد' }),
    }),
    env,
  });
  assert.equal(res.status, 200);
  const { trip } = await res.json();
  assert.equal(trip.payment_status, 'pending');

  const listRes = await listTrips({ request: reqWithCookie('https://smatrips.ai/api/trips', token), env });
  const body = await listRes.json();
  assert.equal(body.trips.length, 1);
});

test('trips API: a non-string html value is rejected (400), not saved', async () => {
  const db = createFakeD1();
  await ensureUser(db, '0555777778');
  const token = await createSessionToken(SECRET, '0555777778');
  const env = { SESSION_SECRET: SECRET, DB: db };

  const res = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'رحلة', html: 12345 }),
    }),
    env,
  });
  assert.equal(res.status, 400);

  const listRes = await listTrips({ request: reqWithCookie('https://smatrips.ai/api/trips', token), env });
  const body = await listRes.json();
  assert.equal(body.trips.length, 0, 'a rejected malformed request must not create a trip row');
});

test('trips API: oversized trip html content is rejected (413), not saved', async () => {
  const db = createFakeD1();
  await ensureUser(db, '0555888888');
  const token = await createSessionToken(SECRET, '0555888888');
  const env = { SESSION_SECRET: SECRET, DB: db };

  const oversizedHtml = 'x'.repeat(2 * 1024 * 1024 + 1); // متجاوز حدّ 2 ميغابايت المفروض في trips/index.js
  const res = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'رحلة ضخمة', html: oversizedHtml }),
    }),
    env,
  });
  assert.equal(res.status, 413);

  const listRes = await listTrips({ request: reqWithCookie('https://smatrips.ai/api/trips', token), env });
  const body = await listRes.json();
  assert.equal(body.trips.length, 0, 'a rejected oversized request must not create a trip row');
});

test('subscription/status: fails closed (503, not 200-active) when the DB layer errors', async () => {
  const token = await createSessionToken(SECRET, '0555666666');
  const brokenDb = {
    prepare() {
      return { bind: () => ({ first: async () => { throw new Error('D1 unavailable'); } }) };
    },
  };
  const res = await subscriptionStatus({ request: reqWithCookie('https://smatrips.ai/api/subscription/status', token), env: { SESSION_SECRET: SECRET, DB: brokenDb } });
  assert.equal(res.status, 503);
  assert.notEqual(res.status, 200);
});
