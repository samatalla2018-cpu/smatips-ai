#!/usr/bin/env node
// Priority 5/6: post-deploy smoke test. Hits a small set of endpoints against a live base URL
// and checks they behave as expected — does not require any credentials, never sends real OTPs
// or payments. Run after every deploy: `BASE_URL=https://smatripsai.pages.dev npm run smoke`.

const BASE_URL = process.env.BASE_URL || process.argv[2];
if (!BASE_URL) {
  console.error('Usage: BASE_URL=https://your-deployment.pages.dev npm run smoke');
  process.exit(1);
}

const checks = [];
function check(name, fn) { checks.push({ name, fn }); }

check('home page responds and is HTML', async () => {
  const res = await fetch(BASE_URL, { redirect: 'manual' });
  if (![200, 301, 302].includes(res.status)) throw new Error(`unexpected status ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!type.includes('text/html')) throw new Error(`expected HTML content-type, got "${type}"`);
});

check('unauthenticated /api/subscription/status is rejected (401), never 200', async () => {
  const res = await fetch(`${BASE_URL}/api/subscription/status`);
  if (res.status !== 401) throw new Error(`expected 401 without a session, got ${res.status}`);
});

check('unauthenticated /api/trips is rejected (401)', async () => {
  const res = await fetch(`${BASE_URL}/api/trips`);
  if (res.status !== 401) throw new Error(`expected 401 without a session, got ${res.status}`);
});

check('send-otp rejects a request with no phone (400), does not 500', async () => {
  const res = await fetch(`${BASE_URL}/api/send-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  });
  if (res.status !== 400) throw new Error(`expected 400 for missing phone, got ${res.status}`);
});

check('verify-otp rejects an invalid code, never 200/sets a session for garbage input', async () => {
  const res = await fetch(`${BASE_URL}/api/verify-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0500000000', otp: '000000' }),
  });
  if (res.status === 200) throw new Error('an unverified OTP must never return 200 with a session');
  if (res.headers.get('set-cookie')) throw new Error('an unverified OTP must never set a session cookie');
});

check('payment webhook rejects a missing/wrong token (401)', async () => {
  const res = await fetch(`${BASE_URL}/api/payment/webhook?token=definitely-wrong`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'inv_smoke' }),
  });
  if (res.status !== 401) throw new Error(`expected 401 for an invalid webhook token, got ${res.status}`);
});

let failed = 0;
for (const { name, fn } of checks) {
  try {
    await fn();
    console.log(`OK   ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${name} — ${err.message}`);
  }
}

console.log(`\n${checks.length - failed}/${checks.length} smoke checks passed.`);
process.exit(failed > 0 ? 1 : 0);
