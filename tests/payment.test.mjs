// اختبارات أولوية 3: دورة حياة الدفع. الحالة الموثوقة الوحيدة هي ما يؤكده Moyasar فعليًا عبر
// استدعاء خادم-إلى-خادم — وليس حقل status في جسم طلب الويبهوك، ولا أي قيمة من المتصفح.

import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as webhook } from '../functions/api/payment/webhook.js';
import { onRequestPost as createPayment } from '../functions/api/payment/create.js';
import { onRequestPost as createTrip } from '../functions/api/trips/index.js';
import { createSessionToken } from '../functions/_utils.js';
import { createFakeD1 } from './helpers/fakeD1.mjs';

const SESSION_SECRET = 'test-session-secret';
function reqWithCookie(url, token, init = {}) {
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Cookie', `smatrips_session=${encodeURIComponent(token)}`);
  return new Request(url, { ...init, headers });
}

const realFetch = globalThis.fetch;
function mockFetch(impl) { globalThis.fetch = impl; }
function restoreFetch() { globalThis.fetch = realFetch; }
function jsonRes(status, body) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }

const SECRET = 'whsec_test';
function webhookRequest(payload, token = SECRET) {
  return new Request(`https://smatrips.ai/api/payment/webhook?token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}

function baseEnv(db) {
  return { MOYASAR_WEBHOOK_SECRET: SECRET, MOYASAR_SECRET_KEY: 'sk_test', DB: db };
}

async function seedSubscription(db, phone, invoiceId) {
  await db.prepare('INSERT OR IGNORE INTO users (phone, created_at) VALUES (?, ?)').bind(phone, Date.now()).run();
  await db.prepare("INSERT OR IGNORE INTO subscriptions (phone, status, moyasar_invoice_id, created_at) VALUES (?, 'pending', ?, ?)")
    .bind(phone, invoiceId, Date.now()).run();
}

// يزرع رحلة غير مدفوعة تخص هاتفًا معيّنًا — مطابق لما تنتجه POST /api/trips فعليًا (payment_status
// يبدأ 'pending' دائمًا)، يُستخدم هنا مباشرة على القاعدة لاختبار تفعيل الويبهوك لكل trip_id.
async function seedTrip(db, phone, tripId) {
  await db.prepare('INSERT OR IGNORE INTO users (phone, created_at) VALUES (?, ?)').bind(phone, Date.now()).run();
  await db.prepare("INSERT INTO trips (id, phone, title, html_content, payment_status, created_at) VALUES (?, ?, 'رحلة اختبار', '', 'pending', ?)")
    .bind(tripId, phone, Date.now()).run();
}

test('webhook: unauthorized without the correct token', async () => {
  const db = createFakeD1();
  const res = await webhook({ request: webhookRequest({ id: 'inv_1' }, 'wrong-token'), env: baseEnv(db) });
  assert.equal(res.status, 401);
});

test('webhook: invalid/missing invoice identifier -> 400, no lookup attempted', async () => {
  const db = createFakeD1();
  let fetchCalled = false;
  mockFetch(async () => { fetchCalled = true; return jsonRes(200, {}); });
  try {
    const res = await webhook({ request: webhookRequest({ type: 'payment.paid' }), env: baseEnv(db) });
    assert.equal(res.status, 400);
    assert.equal(fetchCalled, false, 'must not call the provider without a valid invoice id');
  } finally { restoreFetch(); }
});

test('webhook: successful payment — activates subscription only after Moyasar confirms paid', async () => {
  const db = createFakeD1();
  await seedSubscription(db, '0555700001', 'inv_ok_1');
  mockFetch(async () => jsonRes(200, { id: 'inv_ok_1', status: 'paid', metadata: { phone: '0555700001' } }));
  try {
    const res = await webhook({ request: webhookRequest({ id: 'inv_ok_1' }), env: baseEnv(db) });
    assert.equal(res.status, 200);
    const row = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind('0555700001').first();
    assert.equal(row.status, 'active');
  } finally { restoreFetch(); }
});

test('webhook: body claiming "paid" is ignored if Moyasar itself reports a different status (anti-forgery)', async () => {
  const db = createFakeD1();
  await seedSubscription(db, '0555700002', 'inv_forged');
  // جسم الطلب يدّعي أن الدفع تم، لكن Moyasar (المصدر الحقيقي) يقول إن الفاتورة لم تُدفع بعد.
  mockFetch(async () => jsonRes(200, { id: 'inv_forged', status: 'initiated', metadata: { phone: '0555700002' } }));
  try {
    const res = await webhook({
      request: webhookRequest({ id: 'inv_forged', status: 'paid', metadata: { phone: '0555700002' } }),
      env: baseEnv(db),
    });
    assert.equal(res.status, 200);
    const row = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind('0555700002').first();
    assert.equal(row.status, 'pending', 'a forged body status must never activate a subscription');
  } finally { restoreFetch(); }
});

test('webhook: failed payment does not activate a subscription', async () => {
  const db = createFakeD1();
  await seedSubscription(db, '0555700003', 'inv_failed');
  mockFetch(async () => jsonRes(200, { id: 'inv_failed', status: 'failed', metadata: { phone: '0555700003' } }));
  try {
    const res = await webhook({ request: webhookRequest({ id: 'inv_failed' }), env: baseEnv(db) });
    assert.equal(res.status, 200);
    const row = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind('0555700003').first();
    assert.equal(row.status, 'pending');
  } finally { restoreFetch(); }
});

test('webhook: duplicate callback for the same paid invoice is idempotent (processed once, no error)', async () => {
  const db = createFakeD1();
  await seedSubscription(db, '0555700004', 'inv_dup');
  mockFetch(async () => jsonRes(200, { id: 'inv_dup', status: 'paid', metadata: { phone: '0555700004' } }));
  try {
    const first = await webhook({ request: webhookRequest({ id: 'inv_dup' }), env: baseEnv(db) });
    const second = await webhook({ request: webhookRequest({ id: 'inv_dup' }), env: baseEnv(db) });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const row = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind('0555700004').first();
    assert.equal(row.status, 'active');
    const events = await db.prepare('SELECT COUNT(*) AS n FROM payment_events WHERE invoice_id = ?').bind('inv_dup').first();
    assert.equal(events.n, 1, 'the duplicate callback must not create a second event row');
  } finally { restoreFetch(); }
});

test('webhook: interrupted/failed provider verification (network error) does not activate and signals retry', async () => {
  const db = createFakeD1();
  await seedSubscription(db, '0555700005', 'inv_interrupted');
  mockFetch(async () => { throw new Error('network down'); });
  try {
    const res = await webhook({ request: webhookRequest({ id: 'inv_interrupted' }), env: baseEnv(db) });
    assert.equal(res.status, 502, 'must signal failure (non-2xx) so the provider retries, not silently succeed');
    const row = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind('0555700005').first();
    assert.equal(row.status, 'pending');
  } finally { restoreFetch(); }
});

test('webhook: retry after the interrupted call succeeds and activates exactly once', async () => {
  const db = createFakeD1();
  await seedSubscription(db, '0555700006', 'inv_retry');
  mockFetch(async () => jsonRes(200, { id: 'inv_retry', status: 'paid', metadata: { phone: '0555700006' } }));
  try {
    const res = await webhook({ request: webhookRequest({ id: 'inv_retry' }), env: baseEnv(db) });
    assert.equal(res.status, 200);
    const row = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind('0555700006').first();
    assert.equal(row.status, 'active');
  } finally { restoreFetch(); }
});

test('webhook: unauthorized payment lookup cannot be used to activate an arbitrary phone number', async () => {
  const db = createFakeD1();
  await seedSubscription(db, '0555700007', 'inv_real');
  // مهاجم يعرف invoice id حقيقي لكن يحاول حقن رقم هاتف مختلف في جسم الطلب — يجب تجاهله
  // لأننا نستخدم metadata.phone من استجابة Moyasar الحقيقية فقط، وليس من الجسم الوارد.
  mockFetch(async () => jsonRes(200, { id: 'inv_real', status: 'paid', metadata: { phone: '0555700007' } }));
  try {
    const res = await webhook({
      request: webhookRequest({ id: 'inv_real', metadata: { phone: '0555999999' } }),
      env: baseEnv(db),
    });
    assert.equal(res.status, 200);
    const attackerRow = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind('0555999999').first();
    assert.equal(attackerRow, null, 'no subscription must be created/activated for a phone not confirmed by Moyasar');
    const realRow = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind('0555700007').first();
    assert.equal(realRow.status, 'active');
  } finally { restoreFetch(); }
});

test('webhook: a transient DB failure during activation must not permanently strand a paid customer as pending', async () => {
  const db = createFakeD1();
  const phone = '0555700008';
  const invoiceId = 'inv_activation_flaky';
  await seedSubscription(db, phone, invoiceId);

  let failActivation = true;
  const flakyDb = {
    prepare(sql) {
      if (failActivation && sql.includes("SET status = 'active'")) {
        throw new Error('simulated D1 outage during activation');
      }
      return db.prepare(sql);
    },
  };

  mockFetch(async () => jsonRes(200, { id: invoiceId, status: 'paid', metadata: { phone } }));
  try {
    const first = await webhook({ request: webhookRequest({ id: invoiceId }), env: { MOYASAR_WEBHOOK_SECRET: SECRET, MOYASAR_SECRET_KEY: 'sk_test', DB: flakyDb } });
    assert.equal(first.status, 502, 'a failed activation write must signal non-2xx so Moyasar retries, not a false 200');
    let row = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind(phone).first();
    assert.equal(row.status, 'pending');

    // القاعدة تعافت والآن Moyasar يعيد إرسال نفس الحدث — يجب أن ينجح التفعيل هذه المرة،
    // وليس أن يُعامَل كـ"مكرر تم تجاهله" رغم أن التفعيل الفعلي لم يحدث في المحاولة الأولى.
    failActivation = false;
    const second = await webhook({ request: webhookRequest({ id: invoiceId }), env: { MOYASAR_WEBHOOK_SECRET: SECRET, MOYASAR_SECRET_KEY: 'sk_test', DB: flakyDb } });
    assert.equal(second.status, 200);
    row = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind(phone).first();
    assert.equal(row.status, 'active', 'the retry after recovery must still activate the subscription');
  } finally { restoreFetch(); }
});

// ==== الدفع لكل رحلة (trip_id) — functions/api/payment/create.js يضع trip_id في metadata، وهذا
// القسم يتحقق أن الويبهوك يفعّل الرحلة الصحيحة تحديدًا، بنفس آلية إعادة التحقق من Moyasar وعدم
// الثقة بجسم الطلب المستخدمة أعلاه للاشتراك القديم — لا شيء من ذلك تغيّر، فقط هدف التفعيل.

test('webhook: paid invoice with metadata.trip_id activates that specific trip, not a subscription', async () => {
  const db = createFakeD1();
  const phone = '0555700010';
  const tripId = 'trip_aaa';
  await seedTrip(db, phone, tripId);
  mockFetch(async () => jsonRes(200, { id: 'inv_trip_1', status: 'paid', amount: 4900, metadata: { phone, trip_id: tripId } }));
  try {
    const res = await webhook({ request: webhookRequest({ id: 'inv_trip_1' }), env: baseEnv(db) });
    assert.equal(res.status, 200);
    const row = await db.prepare('SELECT payment_status, amount_sar FROM trips WHERE id = ?').bind(tripId).first();
    assert.equal(row.payment_status, 'paid');
    assert.equal(row.amount_sar, 49);
    const subRow = await db.prepare('SELECT * FROM subscriptions WHERE phone = ?').bind(phone).first();
    assert.equal(subRow, null, 'per-trip payment must not create/activate a phone-wide subscription row');
  } finally { restoreFetch(); }
});

test('webhook: paying for one trip does not activate a second, unrelated trip for the same phone', async () => {
  const db = createFakeD1();
  const phone = '0555700011';
  const paidTripId = 'trip_bbb_paid';
  const otherTripId = 'trip_bbb_other';
  await seedTrip(db, phone, paidTripId);
  await seedTrip(db, phone, otherTripId);
  mockFetch(async () => jsonRes(200, { id: 'inv_trip_2', status: 'paid', metadata: { phone, trip_id: paidTripId } }));
  try {
    const res = await webhook({ request: webhookRequest({ id: 'inv_trip_2' }), env: baseEnv(db) });
    assert.equal(res.status, 200);
    const paidRow = await db.prepare('SELECT payment_status FROM trips WHERE id = ?').bind(paidTripId).first();
    const otherRow = await db.prepare('SELECT payment_status FROM trips WHERE id = ?').bind(otherTripId).first();
    assert.equal(paidRow.payment_status, 'paid');
    assert.equal(otherRow.payment_status, 'pending', 'a sibling trip must never be unlocked by an unrelated invoice');
  } finally { restoreFetch(); }
});

test('webhook: a request body claiming a different trip_id is ignored — only Moyasar\'s real invoice metadata decides', async () => {
  const db = createFakeD1();
  const phone = '0555700012';
  const realTripId = 'trip_real';
  const victimTripId = 'trip_victim';
  await seedTrip(db, phone, realTripId);
  await seedTrip(db, '0555999999', victimTripId);
  // Moyasar (مصدر الحقيقة) يقول إن الفاتورة تخص realTripId، لكن جسم طلب الويبهوك نفسه يدّعي trip_id مختلفًا
  mockFetch(async () => jsonRes(200, { id: 'inv_trip_3', status: 'paid', metadata: { phone, trip_id: realTripId } }));
  try {
    const res = await webhook({
      request: webhookRequest({ id: 'inv_trip_3', metadata: { trip_id: victimTripId } }),
      env: baseEnv(db),
    });
    assert.equal(res.status, 200);
    const victimRow = await db.prepare('SELECT payment_status FROM trips WHERE id = ?').bind(victimTripId).first();
    assert.equal(victimRow.payment_status, 'pending', 'a forged trip_id in the webhook body must never unlock someone else\'s trip');
    const realRow = await db.prepare('SELECT payment_status FROM trips WHERE id = ?').bind(realTripId).first();
    assert.equal(realRow.payment_status, 'paid');
  } finally { restoreFetch(); }
});

test('webhook: legacy invoice with only metadata.phone (no trip_id) still falls back to activating a subscription', async () => {
  const db = createFakeD1();
  await seedSubscription(db, '0555700013', 'inv_legacy');
  mockFetch(async () => jsonRes(200, { id: 'inv_legacy', status: 'paid', metadata: { phone: '0555700013' } }));
  try {
    const res = await webhook({ request: webhookRequest({ id: 'inv_legacy' }), env: baseEnv(db) });
    assert.equal(res.status, 200);
    const row = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind('0555700013').first();
    assert.equal(row.status, 'active', 'an in-flight pre-migration invoice (no trip_id) must still complete via the legacy path');
  } finally { restoreFetch(); }
});

// ==== إنشاء الدفع (functions/api/payment/create.js) — ملكية trip_id تُتحقّق دائمًا من الجلسة
// الموثوقة عبر D1، وليس من الجسم الوارد؛ الرحلة المدفوعة مسبقًا لا تُنشئ فاتورة مكرَّرة.

function moyasarInvoiceCreateEnv(db) {
  return { SESSION_SECRET, MOYASAR_SECRET_KEY: 'sk_test', SUBSCRIPTION_PRICE_SAR: '49', DB: db };
}

test('payment/create: rejects a trip_id belonging to another user (server verifies ownership, never trusts the body)', async () => {
  const db = createFakeD1();
  const ownerToken = await createSessionToken(SESSION_SECRET, '0555700020');
  const attackerToken = await createSessionToken(SESSION_SECRET, '0555700021');
  const env = moyasarInvoiceCreateEnv(db);

  const createRes = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', ownerToken, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'رحلة الضحية' }),
    }),
    env,
  });
  const { trip } = await createRes.json();

  let moyasarCalled = false;
  mockFetch(async () => { moyasarCalled = true; return jsonRes(200, { id: 'inv_x', url: 'https://pay.moyasar.com/x' }); });
  try {
    const res = await createPayment({
      request: reqWithCookie('https://smatrips.ai/api/payment/create', attackerToken, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trip_id: trip.id }),
      }),
      env,
    });
    assert.equal(res.status, 403);
    assert.equal(moyasarCalled, false, 'must not even contact Moyasar for a trip the caller does not own');
  } finally { restoreFetch(); }
});

test('payment/create: an already-paid trip is rejected (409), no duplicate invoice created', async () => {
  const db = createFakeD1();
  const token = await createSessionToken(SESSION_SECRET, '0555700022');
  const env = moyasarInvoiceCreateEnv(db);

  const createRes = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'رحلة مدفوعة' }),
    }),
    env,
  });
  const { trip } = await createRes.json();
  await db.prepare("UPDATE trips SET payment_status = 'paid' WHERE id = ?").bind(trip.id).run();

  let moyasarCalled = false;
  mockFetch(async () => { moyasarCalled = true; return jsonRes(200, { id: 'inv_y', url: 'https://pay.moyasar.com/y' }); });
  try {
    const res = await createPayment({
      request: reqWithCookie('https://smatrips.ai/api/payment/create', token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trip_id: trip.id }),
      }),
      env,
    });
    assert.equal(res.status, 409);
    assert.equal(moyasarCalled, false, 'must not create a second invoice for a trip that is already paid');
  } finally { restoreFetch(); }
});

test('payment/create: a valid request for your own unpaid trip creates a Moyasar invoice carrying trip_id in metadata', async () => {
  const db = createFakeD1();
  const token = await createSessionToken(SESSION_SECRET, '0555700023');
  const env = moyasarInvoiceCreateEnv(db);

  const createRes = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'رحلة جاهزة للدفع' }),
    }),
    env,
  });
  const { trip } = await createRes.json();

  let sentBody = null;
  mockFetch(async (url, opts) => {
    sentBody = JSON.parse(opts.body);
    return jsonRes(200, { id: 'inv_z', url: 'https://pay.moyasar.com/z' });
  });
  try {
    const res = await createPayment({
      request: reqWithCookie('https://smatrips.ai/api/payment/create', token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trip_id: trip.id }),
      }),
      env,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.url, 'https://pay.moyasar.com/z');
    assert.equal(sentBody.metadata.trip_id, trip.id);
    assert.equal(sentBody.amount, 4900, '49 SAR must be sent as 4900 halalas');
  } finally { restoreFetch(); }
});
