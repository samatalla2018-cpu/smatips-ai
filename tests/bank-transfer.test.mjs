// اختبارات التحويل البنكي: كل طلب مرتبط بـ trip_id واحد، رفع الإيصال وحده لا يفتح الرحلة أبدًا،
// الاعتماد يمر عبر activateTripPayment() نفسها المستخدمة لـ Moyasar (لا "Trip Pass" منفصل)، ولوحة
// الإدارة تتحقق من صلاحية Admin سيرفر-side حقيقية (ADMIN_PHONES) وليس فقط إخفاء الرابط.

import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as createTrip } from '../functions/api/trips/index.js';
import { onRequestPost as createBankTransfer } from '../functions/api/payment/bank-transfer/create.js';
import { onRequestGet as bankTransferStatus } from '../functions/api/payment/bank-transfer/status.js';
import { onRequestPost as submitProof } from '../functions/api/payment/bank-transfer/submit-proof.js';
import { onRequestGet as adminList } from '../functions/api/payment/bank-transfer/admin/list.js';
import { onRequestPost as adminApprove } from '../functions/api/payment/bank-transfer/admin/approve.js';
import { onRequestPost as adminReject } from '../functions/api/payment/bank-transfer/admin/reject.js';
import { onRequestGet as adminReceipt } from '../functions/api/payment/bank-transfer/admin/receipt/[id].js';
import { createSessionToken } from '../functions/_utils.js';
import { notifyAdminOfBankTransferRequest } from '../functions/_email.js';
import { createFakeD1 } from './helpers/fakeD1.mjs';
import { createFakeR2 } from './helpers/fakeR2.mjs';

const SESSION_SECRET = 'test-session-secret';
const ADMIN_PHONE = '0555000000';

const realFetch = globalThis.fetch;
function mockFetch(impl) { globalThis.fetch = impl; }
function restoreFetch() { globalThis.fetch = realFetch; }

function reqWithCookie(url, token, init = {}) {
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Cookie', `smatrips_session=${encodeURIComponent(token)}`);
  return new Request(url, { ...init, headers });
}

function baseEnv(db, r2, extra = {}) {
  return {
    SESSION_SECRET,
    DB: db,
    RECEIPTS_BUCKET: r2,
    SUBSCRIPTION_PRICE_SAR: '69',
    REGULAR_PRICE_SAR: '89',
    BANK_NAME: 'بنك الاختبار',
    BANK_ACCOUNT_NAME: 'صاحب الحساب',
    BANK_IBAN: 'SA0000000000000000000000',
    ADMIN_PHONES: ADMIN_PHONE,
    ...extra,
  };
}

async function makeTrip(env, phone, title = 'رحلة اختبار') {
  const token = await createSessionToken(SESSION_SECRET, phone);
  const res = await createTrip({
    request: reqWithCookie('https://smatrips.ai/api/trips', token, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    }),
    env,
  });
  const { trip } = await res.json();
  return { token, trip };
}

function jsonPost(url, token, body) {
  return reqWithCookie(url, token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

// ==== إنشاء طلب التحويل ====

test('bank-transfer/create: rejects a trip_id belonging to another user', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const owner = await makeTrip(env, '0555700100');
  const attackerToken = await createSessionToken(SESSION_SECRET, '0555700101');

  const res = await createBankTransfer({
    request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', attackerToken, { trip_id: owner.trip.id }),
    env,
  });
  assert.equal(res.status, 403);
});

test('bank-transfer/create: rejects an already-paid trip', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700102');
  await db.prepare("UPDATE trips SET payment_status = 'paid' WHERE id = ?").bind(trip.id).run();

  const res = await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });
  assert.equal(res.status, 409);
});

test('bank-transfer/create: amount/regular price always come from server env, not the request body', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700103');

  const res = await createBankTransfer({
    request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id, amount_due_sar: 1, regular_price_sar: 1 }),
    env,
  });
  assert.equal(res.status, 200);
  const { request: reqBody } = await res.json();
  assert.equal(reqBody.amount_due_sar, 69);
  assert.equal(reqBody.regular_price_sar, 89);
  assert.match(reqBody.order_number, /^SMA-[A-Z0-9]{6}$/);
});

test('bank-transfer/create: calling twice for the same trip returns the same active request, not a duplicate', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700104');

  const first = await (await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env })).json();
  const second = await (await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env })).json();

  assert.equal(second.already_exists, true);
  assert.equal(second.request.order_number, first.request.order_number);
  const count = await db.prepare("SELECT COUNT(*) AS n FROM bank_transfer_requests WHERE trip_id = ?").bind(trip.id).first();
  assert.equal(count.n, 1, 'must not create a second active request for the same trip');
});

test('bank-transfer/create: fails closed (500) if bank account details are not configured on the server', async () => {
  const db = createFakeD1(); const r2 = createFakeR2();
  const env = baseEnv(db, r2, { BANK_IBAN: undefined });
  const { token, trip } = await makeTrip(env, '0555700105');
  const res = await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });
  assert.equal(res.status, 500);
});

// ==== إرسال إثبات التحويل ====

function multipartRequest(url, token, fields, fileEntry) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  if (fileEntry) fd.set('receipt', fileEntry);
  const headers = new Headers();
  if (token) headers.set('Cookie', `smatrips_session=${encodeURIComponent(token)}`);
  return new Request(url, { method: 'POST', headers, body: fd });
}

test('submit-proof: sender_name is required', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700110');
  await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });

  const res = await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: '' }), env });
  assert.equal(res.status, 400);
});

test('submit-proof: rejects a trip_id belonging to another user', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const owner = await makeTrip(env, '0555700111');
  await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', owner.token, { trip_id: owner.trip.id }), env });
  const attackerToken = await createSessionToken(SESSION_SECRET, '0555700112');

  const res = await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', attackerToken, { trip_id: owner.trip.id, sender_name: 'مهاجم' }), env });
  assert.equal(res.status, 403);
});

test('submit-proof: without an existing bank-transfer request, returns 404', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700113');
  const res = await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: 'أحمد' }), env });
  assert.equal(res.status, 404);
});

test('submit-proof: rejects a disallowed file type, and the request stays "pending" (not under_review)', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700114');
  await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });

  const badFile = new File(['not-an-image'], 'receipt.txt', { type: 'text/plain' });
  const res = await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: 'أحمد' }, badFile), env });
  assert.equal(res.status, 400);
  const row = await db.prepare('SELECT status FROM bank_transfer_requests WHERE trip_id = ?').bind(trip.id).first();
  assert.equal(row.status, 'pending');
});

test('submit-proof: rejects a file larger than 5MB', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700115');
  await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });

  const bigBytes = new Uint8Array(5 * 1024 * 1024 + 1);
  const bigFile = new File([bigBytes], 'receipt.png', { type: 'image/png' });
  const res = await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: 'أحمد' }, bigFile), env });
  assert.equal(res.status, 413);
});

test('submit-proof: a valid submission moves the request to under_review, stores the receipt in R2, and never touches trips.payment_status', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700116');
  await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });

  const file = new File([new Uint8Array([1, 2, 3])], 'receipt.png', { type: 'image/png' });
  const res = await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: 'أحمد' }, file), env });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'under_review');

  const row = await db.prepare('SELECT status, receipt_asset_key, sender_name FROM bank_transfer_requests WHERE trip_id = ?').bind(trip.id).first();
  assert.equal(row.status, 'under_review');
  assert.equal(row.sender_name, 'أحمد');
  assert.ok(row.receipt_asset_key, 'a receipt key must be stored');
  assert.ok(r2._store.has(row.receipt_asset_key), 'the file must actually be written to R2');

  // متطلب أساسي: رفع الإيصال وحده لا يفتح الرحلة أبدًا — فقط الاعتماد الإداري يفعل ذلك.
  const tripRow = await db.prepare('SELECT payment_status FROM trips WHERE id = ?').bind(trip.id).first();
  assert.equal(tripRow.payment_status, 'pending');
});

test('submit-proof: resubmitting after a request already moved to under_review is rejected (409), no duplicate', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700117');
  await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });
  await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: 'أحمد' }), env });

  const res = await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: 'أحمد مرة أخرى' }), env });
  assert.equal(res.status, 409);
});

// ==== حالة الطلب للمستخدم ====

test('bank-transfer/status: returns null when no request exists, and the latest request otherwise', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700120');

  const before = await (await bankTransferStatus({ request: reqWithCookie(`https://smatrips.ai/api/payment/bank-transfer/status?trip_id=${trip.id}`, token), env })).json();
  assert.equal(before.request, null);

  await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });
  const after = await (await bankTransferStatus({ request: reqWithCookie(`https://smatrips.ai/api/payment/bank-transfer/status?trip_id=${trip.id}`, token), env })).json();
  assert.equal(after.request.status, 'pending');
});

test('bank-transfer/status: another user cannot read this trip\'s bank-transfer status', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const owner = await makeTrip(env, '0555700121');
  const attackerToken = await createSessionToken(SESSION_SECRET, '0555700122');
  const res = await bankTransferStatus({ request: reqWithCookie(`https://smatrips.ai/api/payment/bank-transfer/status?trip_id=${owner.trip.id}`, attackerToken), env });
  assert.equal(res.status, 403);
});

// ==== لوحة الإدارة ====

test('admin endpoints: no session -> 401', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const res = await adminList({ request: new Request('https://smatrips.ai/api/payment/bank-transfer/admin/list'), env });
  assert.equal(res.status, 401);
});

test('admin endpoints: authenticated but non-admin phone -> 403 (not just a hidden URL)', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const regularToken = await createSessionToken(SESSION_SECRET, '0555700130');
  const res = await adminList({ request: reqWithCookie('https://smatrips.ai/api/payment/bank-transfer/admin/list', regularToken), env });
  assert.equal(res.status, 403);
});

test('admin endpoints: fail closed when ADMIN_PHONES is not configured at all', async () => {
  const db = createFakeD1(); const r2 = createFakeR2();
  const env = baseEnv(db, r2, { ADMIN_PHONES: '' });
  const adminToken = await createSessionToken(SESSION_SECRET, ADMIN_PHONE);
  const res = await adminList({ request: reqWithCookie('https://smatrips.ai/api/payment/bank-transfer/admin/list', adminToken), env });
  assert.equal(res.status, 403, 'an empty ADMIN_PHONES must mean nobody is admin, never everyone');
});

async function fullReviewFlow(env, phone) {
  const { token, trip } = await makeTrip(env, phone);
  await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });
  const file = new File([new Uint8Array([9, 9, 9])], 'r.png', { type: 'image/png' });
  await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: 'ريم' }, file), env });
  const row = await env.DB.prepare('SELECT id FROM bank_transfer_requests WHERE trip_id = ?').bind(trip.id).first();
  return { token, trip, requestId: row.id };
}

test('admin/approve: under_review -> paid, and reuses activateTripPayment (trip becomes unlocked, no separate Trip Pass table)', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { trip, requestId } = await fullReviewFlow(env, '0555700140');
  const adminToken = await createSessionToken(SESSION_SECRET, ADMIN_PHONE);

  const res = await adminApprove({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/admin/approve', adminToken, { request_id: requestId }), env });
  assert.equal(res.status, 200);

  const tripRow = await db.prepare('SELECT payment_status, amount_sar FROM trips WHERE id = ?').bind(trip.id).first();
  assert.equal(tripRow.payment_status, 'paid');
  assert.equal(tripRow.amount_sar, 69);

  const reqRow = await db.prepare('SELECT status, reviewed_by FROM bank_transfer_requests WHERE id = ?').bind(requestId).first();
  assert.equal(reqRow.status, 'paid');
  assert.equal(reqRow.reviewed_by, ADMIN_PHONE);
});

test('admin/approve: cannot approve the same request twice (409 on the second call, no duplicate activation)', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { requestId } = await fullReviewFlow(env, '0555700141');
  const adminToken = await createSessionToken(SESSION_SECRET, ADMIN_PHONE);

  const first = await adminApprove({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/admin/approve', adminToken, { request_id: requestId }), env });
  const second = await adminApprove({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/admin/approve', adminToken, { request_id: requestId }), env });
  assert.equal(first.status, 200);
  assert.equal(second.status, 409);
});

test('admin/approve: a non-admin caller cannot approve (403), and the trip stays locked', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { trip, requestId } = await fullReviewFlow(env, '0555700142');
  const attackerToken = await createSessionToken(SESSION_SECRET, '0555999999');

  const res = await adminApprove({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/admin/approve', attackerToken, { request_id: requestId }), env });
  assert.equal(res.status, 403);
  const tripRow = await db.prepare('SELECT payment_status FROM trips WHERE id = ?').bind(trip.id).first();
  assert.equal(tripRow.payment_status, 'pending');
});

test('admin/reject: under_review -> rejected, trip stays locked, and a new request can be created afterward', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip, requestId } = await fullReviewFlow(env, '0555700143');
  const adminToken = await createSessionToken(SESSION_SECRET, ADMIN_PHONE);

  const res = await adminReject({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/admin/reject', adminToken, { request_id: requestId }), env });
  assert.equal(res.status, 200);

  const tripRow = await db.prepare('SELECT payment_status FROM trips WHERE id = ?').bind(trip.id).first();
  assert.equal(tripRow.payment_status, 'pending');

  const retry = await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });
  assert.equal(retry.status, 200);
  const retryBody = await retry.json();
  assert.equal(retryBody.already_exists, false, 'a rejected request must not block creating a new one');
});

test('admin/list: shows has_receipt but never leaks the raw storage key', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  await fullReviewFlow(env, '0555700144');
  const adminToken = await createSessionToken(SESSION_SECRET, ADMIN_PHONE);

  const res = await adminList({ request: reqWithCookie('https://smatrips.ai/api/payment/bank-transfer/admin/list?status=under_review', adminToken), env });
  const { requests } = await res.json();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].has_receipt, true);
  assert.equal(requests[0].receipt_asset_key, undefined);
});

test('admin/receipt: requires admin auth and returns the actual uploaded bytes', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { requestId } = await fullReviewFlow(env, '0555700145');
  const adminToken = await createSessionToken(SESSION_SECRET, ADMIN_PHONE);
  const regularToken = await createSessionToken(SESSION_SECRET, '0555700146');

  const denied = await adminReceipt({ request: reqWithCookie(`https://smatrips.ai/api/payment/bank-transfer/admin/receipt/${requestId}`, regularToken), env, params: { id: requestId } });
  assert.equal(denied.status, 403);

  const res = await adminReceipt({ request: reqWithCookie(`https://smatrips.ai/api/payment/bank-transfer/admin/receipt/${requestId}`, adminToken), env, params: { id: requestId } });
  assert.equal(res.status, 200);
  const buf = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(buf), [9, 9, 9]);
});

test('admin/receipt: 404 when the request has no receipt on file', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const { token, trip } = await makeTrip(env, '0555700147');
  const created = await (await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env })).json();
  const row = await db.prepare('SELECT id FROM bank_transfer_requests WHERE trip_id = ?').bind(trip.id).first();
  const adminToken = await createSessionToken(SESSION_SECRET, ADMIN_PHONE);

  const res = await adminReceipt({ request: reqWithCookie(`https://smatrips.ai/api/payment/bank-transfer/admin/receipt/${row.id}`, adminToken), env, params: { id: row.id } });
  assert.equal(res.status, 404);
});

test('paying via bank transfer for one trip does not unlock a second, unrelated trip for the same phone', async () => {
  const db = createFakeD1(); const r2 = createFakeR2(); const env = baseEnv(db, r2);
  const phone = '0555700148';
  const { requestId, trip: paidTrip } = await fullReviewFlow(env, phone);
  const { trip: otherTrip } = await makeTrip(env, phone, 'رحلة أخرى');
  const adminToken = await createSessionToken(SESSION_SECRET, ADMIN_PHONE);

  await adminApprove({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/admin/approve', adminToken, { request_id: requestId }), env });

  const paidRow = await db.prepare('SELECT payment_status FROM trips WHERE id = ?').bind(paidTrip.id).first();
  const otherRow = await db.prepare('SELECT payment_status FROM trips WHERE id = ?').bind(otherTrip.id).first();
  assert.equal(paidRow.payment_status, 'paid');
  assert.equal(otherRow.payment_status, 'pending', 'a sibling trip must never be unlocked by an unrelated bank-transfer approval');
});

// ==== إشعار الإدارة عند طلب تحويل جديد (اختياري بالكامل، لا يجب أن يكسر حفظ الطلب أبدًا) ====

test('notifyAdminOfBankTransferRequest: skipped (not an error) when ADMIN_EMAIL/RESEND_API_KEY are not configured, no network call attempted', async () => {
  let fetchCalled = false;
  mockFetch(async () => { fetchCalled = true; return new Response('{}', { status: 200 }); });
  try {
    const result = await notifyAdminOfBankTransferRequest({}, { orderNumber: 'SMA-ABC123', amountDueSar: 89, adminUrl: 'https://x/admin/' });
    assert.equal(result.sent, false);
    assert.equal(result.reason, 'not_configured');
    assert.equal(fetchCalled, false, 'must not call the email provider at all when unconfigured');
  } finally { restoreFetch(); }
});

test('notifyAdminOfBankTransferRequest: sends via Resend REST API when configured, without leaking the receipt or sensitive data', async () => {
  let sentBody = null; let sentAuth = null;
  mockFetch(async (url, opts) => {
    sentAuth = opts.headers.Authorization;
    sentBody = JSON.parse(opts.body);
    return new Response('{"id":"email_123"}', { status: 200 });
  });
  try {
    const env = { ADMIN_EMAIL: 'admin@example.com', RESEND_API_KEY: 're_test_key' };
    const result = await notifyAdminOfBankTransferRequest(env, { orderNumber: 'SMA-XYZ789', amountDueSar: 89, adminUrl: 'https://smatrips.ai/admin/' });
    assert.equal(result.sent, true);
    assert.equal(sentAuth, 'Bearer re_test_key');
    assert.equal(sentBody.to, 'admin@example.com');
    assert.match(sentBody.subject, /SMA-XYZ789/);
    assert.match(sentBody.html, /89/);
    assert.doesNotMatch(sentBody.html, /receipt|إيصال.{0,3}<img|base64/i, 'must never embed the receipt image itself');
  } finally { restoreFetch(); }
});

test('notifyAdminOfBankTransferRequest: a provider/network failure is reported but never thrown', async () => {
  mockFetch(async () => { throw new Error('network down'); });
  try {
    const env = { ADMIN_EMAIL: 'admin@example.com', RESEND_API_KEY: 're_test_key' };
    const result = await notifyAdminOfBankTransferRequest(env, { orderNumber: 'SMA-ERR001', amountDueSar: 89, adminUrl: 'https://x/admin/' });
    assert.equal(result.sent, false);
  } finally { restoreFetch(); }
});

test('submit-proof: succeeds and saves the request even when the admin email notification fails', async () => {
  const db = createFakeD1(); const r2 = createFakeR2();
  const env = baseEnv(db, r2, { ADMIN_EMAIL: 'admin@example.com', RESEND_API_KEY: 're_test_key' });
  const { token, trip } = await makeTrip(env, '0555700150');
  await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });

  mockFetch(async () => { throw new Error('email provider unreachable'); });
  try {
    const res = await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: 'سارة' }), env });
    assert.equal(res.status, 200, 'a failed notification must never fail the actual request/receipt save');
    const row = await db.prepare('SELECT status FROM bank_transfer_requests WHERE trip_id = ?').bind(trip.id).first();
    assert.equal(row.status, 'under_review');
  } finally { restoreFetch(); }
});

test('submit-proof: with notification configured, calls the email provider with this request\'s order number', async () => {
  const db = createFakeD1(); const r2 = createFakeR2();
  const env = baseEnv(db, r2, { ADMIN_EMAIL: 'admin@example.com', RESEND_API_KEY: 're_test_key' });
  const { token, trip } = await makeTrip(env, '0555700151');
  const created = await (await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env })).json();

  let sentBody = null;
  mockFetch(async (url, opts) => { sentBody = JSON.parse(opts.body); return new Response('{}', { status: 200 }); });
  try {
    const res = await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: 'نورة' }), env });
    assert.equal(res.status, 200);
    assert.match(sentBody.subject, new RegExp(created.request.order_number));
  } finally { restoreFetch(); }
});

test('submit-proof: without notification configured, no network call is attempted at all', async () => {
  const db = createFakeD1(); const r2 = createFakeR2();
  const env = baseEnv(db, r2); // بلا ADMIN_EMAIL/RESEND_API_KEY
  const { token, trip } = await makeTrip(env, '0555700152');
  await createBankTransfer({ request: jsonPost('https://smatrips.ai/api/payment/bank-transfer/create', token, { trip_id: trip.id }), env });

  let fetchCalled = false;
  mockFetch(async () => { fetchCalled = true; return new Response('{}', { status: 200 }); });
  try {
    const res = await submitProof({ request: multipartRequest('https://smatrips.ai/api/payment/bank-transfer/submit-proof', token, { trip_id: trip.id, sender_name: 'هند' }), env });
    assert.equal(res.status, 200);
    assert.equal(fetchCalled, false);
  } finally { restoreFetch(); }
});
