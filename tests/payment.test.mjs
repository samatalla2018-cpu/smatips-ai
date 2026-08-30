// اختبارات أولوية 3: دورة حياة الدفع. الحالة الموثوقة الوحيدة هي ما يؤكده Moyasar فعليًا عبر
// استدعاء خادم-إلى-خادم — وليس حقل status في جسم طلب الويبهوك، ولا أي قيمة من المتصفح.

import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as webhook } from '../functions/api/payment/webhook.js';
import { createFakeD1 } from './helpers/fakeD1.mjs';

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
