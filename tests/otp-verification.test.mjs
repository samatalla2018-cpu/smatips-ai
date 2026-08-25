// اختبارات أولوية 1: التحقق من رمز OTP وإنشاء الجلسة الموثوقة.
// يغطي: رمز صحيح، رمز خاطئ، استجابة مشوّهة من المزوّد، انتهاء مهلة الاتصال،
// خطأ 4xx/5xx من المزوّد، تكرار المحاولات (rate limit)، وأن الجلسة تُنشأ فقط بعد تحقق مؤكد.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isOtpVerificationSuccessful, verifySessionToken } from '../functions/_utils.js';
import { onRequestPost as verifyOtp } from '../functions/api/verify-otp.js';
import { onRequestPost as sendOtp } from '../functions/api/send-otp.js';
import { createFakeD1 } from './helpers/fakeD1.mjs';

const realFetch = globalThis.fetch;
function mockFetch(impl) { globalThis.fetch = impl; }
function restoreFetch() { globalThis.fetch = realFetch; }

function verifyRequest(phone, otp, ip = '1.2.3.4') {
  return new Request('https://smatrips.ai/api/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ phone, otp }),
  });
}

function sendRequest(phone, ip = '1.2.3.4') {
  return new Request('https://smatrips.ai/api/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ phone }),
  });
}

function baseEnv(db) {
  return { AUTHENTICA_API_KEY: 'test-key', SESSION_SECRET: 'test-secret', DB: db };
}

function jsonRes(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// ---- 1. دالة القرار النقية (unit) ----

test('isOtpVerificationSuccessful: only explicit {ok:true, success:true} passes', () => {
  assert.equal(isOtpVerificationSuccessful(true, { success: true }), true);
});

test('isOtpVerificationSuccessful: explicit failure rejected', () => {
  assert.equal(isOtpVerificationSuccessful(true, { success: false, message: 'invalid' }), false);
});

test('isOtpVerificationSuccessful: malformed/empty body (data=null) rejected — the original bug', () => {
  // هذا بالضبط الحالة التي كانت تُقبل خطأً قبل الإصلاح: استجابة HTTP 200 بجسم فارغ/غير قابل للتحليل.
  assert.equal(isOtpVerificationSuccessful(true, null), false);
});

test('isOtpVerificationSuccessful: 200 response missing the success field rejected', () => {
  assert.equal(isOtpVerificationSuccessful(true, { message: 'ok' }), false);
});

test('isOtpVerificationSuccessful: success:true but ok=false (unexpected HTTP status) rejected', () => {
  assert.equal(isOtpVerificationSuccessful(false, { success: true }), false);
});

test('isOtpVerificationSuccessful: non-object data rejected', () => {
  assert.equal(isOtpVerificationSuccessful(true, 'success'), false);
  assert.equal(isOtpVerificationSuccessful(true, 42), false);
  assert.equal(isOtpVerificationSuccessful(true, undefined), false);
});

// ---- 2. اختبارات تكامل على المسار الحقيقي لنقطة /api/verify-otp ----

test('verify-otp: correct OTP creates a valid trusted session', async () => {
  const db = createFakeD1();
  mockFetch(async () => jsonRes(200, { success: true }));
  try {
    const res = await verifyOtp({ request: verifyRequest('0555000001', '123456'), env: baseEnv(db) });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('Set-Cookie');
    assert.ok(setCookie && setCookie.includes('smatrips_session='), 'session cookie must be set');
    const token = decodeURIComponent(setCookie.match(/smatrips_session=([^;]+)/)[1]);
    const session = await verifySessionToken(token, 'test-secret');
    assert.ok(session && session.phone === '0555000001', 'session must be valid and scoped to the verified phone');
  } finally { restoreFetch(); }
});

test('verify-otp: incorrect OTP (explicit success:false) does not create a session', async () => {
  const db = createFakeD1();
  mockFetch(async () => jsonRes(200, { success: false, message: 'رمز غير صحيح' }));
  try {
    const res = await verifyOtp({ request: verifyRequest('0555000002', '000000'), env: baseEnv(db) });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('Set-Cookie'), null);
  } finally { restoreFetch(); }
});

test('verify-otp: expired-OTP style rejection (provider explicit failure) does not create a session', async () => {
  const db = createFakeD1();
  mockFetch(async () => jsonRes(200, { success: false, message: 'expired' }));
  try {
    const res = await verifyOtp({ request: verifyRequest('0555000003', '111111'), env: baseEnv(db) });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('Set-Cookie'), null);
  } finally { restoreFetch(); }
});

test('REGRESSION — malformed provider response (200 + unparseable body) must NOT create a session', async () => {
  const db = createFakeD1();
  // res.json() سيرمي استثناء — بالضبط الحالة التي كانت تُلتقط سابقًا كـ {} ثم تُقبل خطأً كنجاح.
  mockFetch(async () => new Response('not json', { status: 200 }));
  try {
    const res = await verifyOtp({ request: verifyRequest('0555000004', '123456'), env: baseEnv(db) });
    assert.equal(res.status, 401, 'malformed provider response must fail closed');
    assert.equal(res.headers.get('Set-Cookie'), null, 'no session cookie may be issued');
  } finally { restoreFetch(); }
});

test('REGRESSION — 200 response with success field missing entirely must NOT create a session', async () => {
  const db = createFakeD1();
  mockFetch(async () => jsonRes(200, { message: 'unexpected shape, no success field' }));
  try {
    const res = await verifyOtp({ request: verifyRequest('0555000005', '123456'), env: baseEnv(db) });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('Set-Cookie'), null);
  } finally { restoreFetch(); }
});

test('provider timeout (fetch throws AbortError) fails closed, no session, no crash', async () => {
  const db = createFakeD1();
  mockFetch(async () => { const e = new Error('The operation was aborted'); e.name = 'AbortError'; throw e; });
  try {
    const res = await verifyOtp({ request: verifyRequest('0555000006', '123456'), env: baseEnv(db) });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('Set-Cookie'), null);
  } finally { restoreFetch(); }
});

test('provider 500 error is never interpreted as success', async () => {
  const db = createFakeD1();
  mockFetch(async () => jsonRes(500, { error: 'internal error' }));
  try {
    const res = await verifyOtp({ request: verifyRequest('0555000007', '123456'), env: baseEnv(db) });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('Set-Cookie'), null);
  } finally { restoreFetch(); }
});

test('provider 400 error is never interpreted as success', async () => {
  const db = createFakeD1();
  mockFetch(async () => jsonRes(400, { success: false, message: 'bad request' }));
  try {
    const res = await verifyOtp({ request: verifyRequest('0555000008', '123456'), env: baseEnv(db) });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('Set-Cookie'), null);
  } finally { restoreFetch(); }
});

test('session is created only after confirmed verification (user/subscription rows appear only on success)', async () => {
  const db = createFakeD1();
  const phone = '0555000009';

  mockFetch(async () => jsonRes(200, { success: false }));
  try {
    await verifyOtp({ request: verifyRequest(phone, '000000'), env: baseEnv(db) });
    const userRow = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
    assert.equal(userRow, null, 'no user row should exist after a failed verification');
  } finally { restoreFetch(); }

  mockFetch(async () => jsonRes(200, { success: true }));
  try {
    const res = await verifyOtp({ request: verifyRequest(phone, '123456', '9.9.9.9'), env: baseEnv(db) });
    assert.equal(res.status, 200);
    const userRow = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
    assert.ok(userRow, 'user row must exist only after a confirmed successful verification');
  } finally { restoreFetch(); }
});

test('repeated verify attempts are rate limited (brute-force protection)', async () => {
  const db = createFakeD1();
  const phone = '0555000010';
  mockFetch(async () => jsonRes(200, { success: false, message: 'wrong code' }));
  try {
    let lastStatus;
    for (let i = 0; i < 7; i++) {
      const res = await verifyOtp({ request: verifyRequest(phone, '000000'), env: baseEnv(db) });
      lastStatus = res.status;
    }
    assert.equal(lastStatus, 429, 'after exceeding the verify-attempt limit, further attempts must be blocked');
  } finally { restoreFetch(); }
});

test('repeated OTP send requests are rate limited (resend / SMS-bombing protection)', async () => {
  const db = createFakeD1();
  const phone = '0555000011';
  mockFetch(async () => jsonRes(200, { success: true }));
  try {
    let lastStatus;
    for (let i = 0; i < 5; i++) {
      const res = await sendOtp({ request: sendRequest(phone), env: baseEnv(db) });
      lastStatus = res.status;
    }
    assert.equal(lastStatus, 429, 'after exceeding the resend limit, further send requests must be blocked');
  } finally { restoreFetch(); }
});

test('missing AUTHENTICA_API_KEY fails closed with a 500, never treated as success', async () => {
  const db = createFakeD1();
  const res = await verifyOtp({ request: verifyRequest('0555000012', '123456'), env: { SESSION_SECRET: 's', DB: db } });
  assert.equal(res.status, 500);
  assert.equal(res.headers.get('Set-Cookie'), null);
});
