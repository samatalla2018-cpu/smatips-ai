// اختبارات تسجيل الدخول الفوري برقم الجوال بعد إلغاء خطوة التحقق عبر رمز OTP/SMS.
// يغطي: إنشاء جلسة موثوقة مباشرة برقم صالح، رفض الطلب بدون رقم جوال، إنشاء صف مستخدم/اشتراك،
// وتحديد المعدّل (rate limiting) لمنع إساءة استخدام نقطة الدخول.

import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySessionToken } from '../functions/_utils.js';
import { onRequestPost as sendOtp } from '../functions/api/send-otp.js';
import { createFakeD1 } from './helpers/fakeD1.mjs';

function loginRequest(phone, ip = '1.2.3.4') {
  return new Request('https://smatrips.ai/api/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ phone }),
  });
}

function baseEnv(db) {
  return { SESSION_SECRET: 'test-secret', DB: db };
}

test('login: a valid phone number creates a trusted session immediately, no OTP required', async () => {
  const db = createFakeD1();
  const res = await sendOtp({ request: loginRequest('0555000001'), env: baseEnv(db) });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('Set-Cookie');
  assert.ok(setCookie && setCookie.includes('smatrips_session='), 'session cookie must be set');
  const token = decodeURIComponent(setCookie.match(/smatrips_session=([^;]+)/)[1]);
  const session = await verifySessionToken(token, 'test-secret');
  assert.ok(session && session.phone === '0555000001', 'session must be valid and scoped to the given phone');
});

test('login: missing phone is rejected (400), no session created', async () => {
  const db = createFakeD1();
  const res = await sendOtp({ request: loginRequest(''), env: baseEnv(db) });
  assert.equal(res.status, 400);
  assert.equal(res.headers.get('Set-Cookie'), null);
});

test('login: user and subscription rows are created on first login for a phone', async () => {
  const db = createFakeD1();
  const phone = '0555000002';
  const res = await sendOtp({ request: loginRequest(phone), env: baseEnv(db) });
  assert.equal(res.status, 200);
  const userRow = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
  assert.ok(userRow, 'user row must exist after login');
  const subRow = await db.prepare('SELECT * FROM subscriptions WHERE phone = ?').bind(phone).first();
  assert.ok(subRow, 'subscription row must exist after login');
});

test('repeated login requests for the same phone are rate limited', async () => {
  const db = createFakeD1();
  const phone = '0555000003';
  let lastStatus;
  for (let i = 0; i < 5; i++) {
    const res = await sendOtp({ request: loginRequest(phone), env: baseEnv(db) });
    lastStatus = res.status;
  }
  assert.equal(lastStatus, 429, 'after exceeding the per-phone limit, further login requests must be blocked');
});
