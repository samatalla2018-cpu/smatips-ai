#!/usr/bin/env node
// Priority 5: validate required environment variables/bindings are present before deploying.
// Only checks PRESENCE, never prints VALUES — safe to run in CI logs.
//
// This reads from process.env, so it validates whatever environment invokes it (e.g. a CI job
// that has pulled the relevant secrets, or a local shell with .dev.vars sourced). It cannot read
// Cloudflare Pages' own dashboard-configured production variables directly — that boundary is
// only inspectable in the Cloudflare dashboard (see PRODUCTION_READINESS_GAP_ANALYSIS.md).

const REQUIRED = [
  'AUTHENTICA_API_KEY',
  'SESSION_SECRET',
  'MOYASAR_SECRET_KEY',
  'MOYASAR_WEBHOOK_SECRET',
  'SUBSCRIPTION_PRICE_SAR',
  'REGULAR_PRICE_SAR',
  'BANK_NAME',
  'BANK_ACCOUNT_NAME',
  'BANK_IBAN',
  'ADMIN_PHONES',
];

const RECOMMENDED = [
  'ALLOWED_PHONE', // اختياري بالتصميم (تجاوز المالك) — لكن غيابه يعني عدم وجود تجاوز، وهذا مقصود أحيانًا
  'ADMIN_EMAIL', // اختياري بالتصميم: إشعار بريدي للإدارة عند طلب تحويل بنكي جديد — بدونه، يُحفظ الطلب بلا إشعار (لا يفشل شيء)
  'RESEND_API_KEY', // اختياري أيضًا، ولازم معًا مع ADMIN_EMAIL لتفعيل الإشعار (functions/_email.js)
];

// ملاحظة: ربط R2 (RECEIPTS_BUCKET) لتخزين إيصالات التحويل البنكي binding وليس متغيّر بيئة نصي —
// لا يظهر في process.env ولا يمكن التحقق من وجوده من هذا السكربت؛ يُضاف يدويًا من لوحة Cloudflare
// Pages (Settings → Functions → R2 bucket bindings)، وتتحقق منه دوال التحويل البنكي نفسها وقت التشغيل.

const missing = REQUIRED.filter((name) => !process.env[name]);

console.log(`Checked ${REQUIRED.length} required variable(s).`);
for (const name of RECOMMENDED) {
  if (!process.env[name]) console.log(`  note: optional var ${name} is not set (expected if no owner bypass is configured).`);
}

if (missing.length > 0) {
  console.error(`\nMissing required environment variable(s): ${missing.join(', ')}`);
  console.error('Set these in the Cloudflare Pages project (Production and/or Preview) before deploying.');
  process.exit(1);
}

console.log('OK — all required environment variables are present in this shell.');
process.exit(0);
