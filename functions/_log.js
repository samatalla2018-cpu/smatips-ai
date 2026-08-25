// أداة تسجيل أحداث آمنة: تكتب سطر JSON إلى console (تُقرأ عبر `wrangler pages deployment tail`
// أو Cloudflare Logpush). لا تكتب أبدًا رمز OTP أو رمز الجلسة أو أي مفتاح API — فقط اسم الحدث،
// نتيجة العملية، ومعرّف هاتف مموّه (hash) لا يمكن عكسه لرقم الهاتف الأصلي.

async function hashForLog(value) {
  if (!value) return null;
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(String(value)));
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 16); // مقطع كافٍ للربط بين الأحداث دون كشف الرقم الأصلي
}

const SENSITIVE_KEYS = new Set(['otp', 'code', 'token', 'session', 'password', 'apiKey', 'api_key', 'secret', 'authorization']);

export async function logEvent(event, fields = {}) {
  const safeFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    if (key === 'phone') {
      safeFields.phoneHash = await hashForLog(value);
      continue;
    }
    safeFields[key] = value;
  }
  try {
    console.log(JSON.stringify({ event, ts: Date.now(), ...safeFields }));
  } catch {
    // لا نكسر الطلب أبدًا بسبب فشل التسجيل
  }
}
