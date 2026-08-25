// اختبارات أولوية 2: التفويض (authorization) يفشل بأمان (fail-closed)، ويُطبَّق من الخادم
// بغض النظر عن الواجهة — تغطي: بلا مصادقة، اشتراك غير مفعّل، مستخدم يحاول الوصول لملف
// مستخدم آخر، وتجاوز المالك (ALLOWED_PHONE) الذي يجب أن يبقى محدود النطاق.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/_utils.js';
import { onRequestGet as listTrips, onRequestPost as createTrip } from '../functions/api/trips/index.js';
import { onRequestGet as getTrip } from '../functions/api/trips/[id].js';
import { onRequestGet as subscriptionStatus } from '../functions/api/subscription/status.js';
import { createFakeD1 } from './helpers/fakeD1.mjs';

const SECRET = 'test-session-secret';

function reqWithCookie(url, token, init = {}) {
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Cookie', `smatrips_session=${encodeURIComponent(token)}`);
  return new Request(url, { ...init, headers });
}

async function activateSubscription(db, phone) {
  await db.prepare('INSERT OR IGNORE INTO users (phone, created_at) VALUES (?, ?)').bind(phone, Date.now()).run();
  await db.prepare("INSERT OR IGNORE INTO subscriptions (phone, status, created_at) VALUES (?, 'pending', ?)").bind(phone, Date.now()).run();
  await db.prepare("UPDATE subscriptions SET status = 'active' WHERE phone = ?").bind(phone).run();
}

async function pendingSubscription(db, phone) {
  await db.prepare('INSERT OR IGNORE INTO users (phone, created_at) VALUES (?, ?)').bind(phone, Date.now()).run();
  await db.prepare("INSERT OR IGNORE INTO subscriptions (phone, status, created_at) VALUES (?, 'pending', ?)").bind(phone, Date.now()).run();
}

test('trips API: no session cookie -> 401, never leaks data', async () => {
  const db = createFakeD1();
  const res = await listTrips({ request: reqWithCookie('https://smatrips.ai/api/trips', null), env: { SESSION_SECRET: SECRET, DB: db } });
  assert.equal(res.status, 401);
});

test('trips API: valid session but subscription pending -> 403 (fails closed, not open)', async () => {
  const db = createFakeD1();
  await pendingSubscription(db, '0555111111');
  const token = await createSessionToken(SECRET, '0555111111');
  const res = await listTrips({ request: reqWithCookie('https://smatrips.ai/api/trips', token), env: { SESSION_SECRET: SECRET, DB: db } });
  assert.equal(res.status, 403);
});

test('trips API: active subscription -> 200 and can list/create own trips', async () => {
  const db = createFakeD1();
  await activateSubscription(db, '0555222222');
  const token = await createSessionToken(SECRET, '0555222222');
  const env = { SESSION_SECRET: SECRET, DB: db };

  const createRes = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'رحلتي لدبي', html: '<html>trip</html>' }),
    }),
    env,
  });
  assert.equal(createRes.status, 200);

  const listRes = await listTrips({ request: reqWithCookie('https://smatrips.ai/api/trips', token), env });
  assert.equal(listRes.status, 200);
  const body = await listRes.json();
  assert.equal(body.trips.length, 1);
});

test('trips API: a user cannot read another user\'s trip file (cross-account access denied)', async () => {
  const db = createFakeD1();
  await activateSubscription(db, '0555333333');
  await activateSubscription(db, '0555444444');
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

  const attackerRes = await getTrip({
    request: reqWithCookie(`https://smatrips.ai/api/trips/${trip.id}`, attackerToken),
    env, params: { id: trip.id },
  });
  assert.equal(attackerRes.status, 403, 'another authenticated user must not be able to read this trip file');

  const ownerRes = await getTrip({
    request: reqWithCookie(`https://smatrips.ai/api/trips/${trip.id}`, ownerToken),
    env, params: { id: trip.id },
  });
  assert.equal(ownerRes.status, 200);
});

test('trips API: forged/tampered session cookie is rejected, not treated as authenticated', async () => {
  const db = createFakeD1();
  const res = await listTrips({
    request: reqWithCookie('https://smatrips.ai/api/trips', 'ZmFrZQ==.notarealsignature'),
    env: { SESSION_SECRET: SECRET, DB: db },
  });
  assert.equal(res.status, 401);
});

test('owner bypass (ALLOWED_PHONE): owner phone gets access without an active subscription', async () => {
  const db = createFakeD1();
  await pendingSubscription(db, '0500000000');
  const token = await createSessionToken(SECRET, '0500000000');
  const env = { SESSION_SECRET: SECRET, DB: db, ALLOWED_PHONE: '0500000000' };
  const res = await listTrips({ request: reqWithCookie('https://smatrips.ai/api/trips', token), env });
  assert.equal(res.status, 200);
});

test('owner bypass (ALLOWED_PHONE): bypass is scoped only to the configured phone, not to any other user', async () => {
  const db = createFakeD1();
  await pendingSubscription(db, '0555555555');
  const token = await createSessionToken(SECRET, '0555555555');
  const env = { SESSION_SECRET: SECRET, DB: db, ALLOWED_PHONE: '0500000000' };
  const res = await listTrips({ request: reqWithCookie('https://smatrips.ai/api/trips', token), env });
  assert.equal(res.status, 403, 'least privilege: only the exact configured owner phone may bypass, no one else');
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
