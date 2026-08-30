// أدوات مشتركة لدوال Cloudflare Pages Functions: توقيع الجلسة + التواصل مع Moyasar

const PROVIDER_TIMEOUT_MS = 8000;

// طلبات خارجية (Authentica/Moyasar) محدودة بمهلة زمنية دائمًا — طلب معلّق لا يجب أن يترك
// المستخدم أو الخادم بلا استجابة، ولا يجوز أبدًا تفسير مهلة منتهية على أنها نجاح.
export async function fetchWithTimeout(url, options, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function hmacSign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createSessionToken(secret, phone, days = 30) {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = btoa(JSON.stringify({ phone, exp }));
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

// يرجع { phone, exp } عند صلاحية الجلسة، أو null — تحتاجه كل نقطة API لمعرفة صاحب الجلسة
export async function verifySessionToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  try {
    const expectedSig = await hmacSign(secret, payload);
    if (sig !== expectedSig) return null;
    const data = JSON.parse(atob(payload));
    if (typeof data.exp !== 'number' || data.exp <= Date.now() || !data.phone) return null;
    return data;
  } catch {
    return null;
  }
}

export function jsonResponse(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

export function readSessionCookie(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)smatrips_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function normalizePhone(phone) {
  return (phone || '').replace(/[\s\-()]/g, '');
}

// ---- طبقة الوصول لقاعدة بيانات D1: المستخدمون + الاشتراكات + ملفات الرحلات ----

export async function ensureUserAndSubscription(db, phone) {
  const now = Date.now();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO users (phone, created_at) VALUES (?, ?)').bind(phone, now),
    db.prepare('INSERT OR IGNORE INTO subscriptions (phone, status, created_at) VALUES (?, ?, ?)').bind(phone, 'pending', now),
  ]);
}

export async function getSubscriptionStatus(db, phone) {
  const row = await db.prepare('SELECT status FROM subscriptions WHERE phone = ?').bind(phone).first();
  return row ? row.status : 'pending';
}

export async function attachInvoiceToSubscription(db, phone, invoiceId) {
  await db.prepare('UPDATE subscriptions SET moyasar_invoice_id = ? WHERE phone = ?').bind(invoiceId, phone).run();
}

export async function activateSubscriptionByPhone(db, phone) {
  await db.prepare("UPDATE subscriptions SET status = 'active', paid_at = ? WHERE phone = ?").bind(Date.now(), phone).run();
}

export async function activateSubscriptionByInvoiceId(db, invoiceId) {
  await db.prepare("UPDATE subscriptions SET status = 'active', paid_at = ? WHERE moyasar_invoice_id = ?").bind(Date.now(), invoiceId).run();
}

export async function listTrips(db, phone) {
  const { results } = await db.prepare('SELECT id, title, created_at FROM trips WHERE phone = ? ORDER BY created_at DESC').bind(phone).all();
  return results || [];
}

export async function createTrip(db, phone, title, htmlContent) {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.prepare('INSERT INTO trips (id, phone, title, html_content, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, phone, title, htmlContent, now).run();
  return { id, title, created_at: now };
}

export async function getTripById(db, id) {
  return db.prepare('SELECT id, phone, title, html_content, created_at FROM trips WHERE id = ?').bind(id).first();
}

// ---- تحديد المعدّل (Rate limiting) لطلبات الدخول برقم الجوال ----
// يُستخدم لمنع إساءة الاستخدام (إنشاء جلسات بكميات كبيرة لأرقام عشوائية).

export const OTP_SEND_LIMIT = { windowMs: 10 * 60 * 1000, maxPerPhone: 3, maxPerIp: 10 };

export async function recordOtpSendAttempt(db, phone, ip) {
  await db.prepare('INSERT INTO otp_send_attempts (phone, ip, created_at) VALUES (?, ?, ?)')
    .bind(phone, ip || null, Date.now()).run();
}

// يرجع true إذا تجاوز الطلب الحد المسموح به (لكل هاتف أو لكل IP) خلال النافذة الزمنية.
export async function isOtpSendRateLimited(db, phone, ip) {
  const since = Date.now() - OTP_SEND_LIMIT.windowMs;
  const byPhone = await db.prepare('SELECT COUNT(*) AS n FROM otp_send_attempts WHERE phone = ? AND created_at > ?')
    .bind(phone, since).first();
  if ((byPhone?.n || 0) >= OTP_SEND_LIMIT.maxPerPhone) return true;
  if (ip) {
    const byIp = await db.prepare('SELECT COUNT(*) AS n FROM otp_send_attempts WHERE ip = ? AND created_at > ?')
      .bind(ip, since).first();
    if ((byIp?.n || 0) >= OTP_SEND_LIMIT.maxPerIp) return true;
  }
  return false;
}

export function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || null;
}

// مقارنة زمن ثابت لسرّ الـ webhook — تمنع هجوم توقيت (timing attack) لتخمين التوكن حرفًا بحرف.
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// يجلب حالة الفاتورة مباشرة من Moyasar (مصدر الحقيقة الوحيد) — لا نثق أبدًا بحقل status
// الوارد في جسم الويبهوك نفسه؛ هذا الاستدعاء هو ما يقرر فعليًا إن كانت الفاتورة مدفوعة.
export async function getMoyasarInvoice(secretKey, invoiceId) {
  try {
    const auth = btoa(`${secretKey}:`);
    const res = await fetchWithTimeout(`https://api.moyasar.com/v1/invoices/${encodeURIComponent(invoiceId)}`, {
      headers: { 'Authorization': `Basic ${auth}` },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: null };
  }
}

// ---- سجل أحداث الدفع (لتتبع/تدقيق الدفعات ومنع معالجة مكررة بصمت) ----

export async function recordPaymentEvent(db, invoiceId, status, phone) {
  try {
    await db.prepare('INSERT INTO payment_events (invoice_id, status, phone, processed_at) VALUES (?, ?, ?, ?)')
      .bind(invoiceId, status, phone || null, Date.now()).run();
    return { firstTime: true };
  } catch {
    // قيد UNIQUE(invoice_id, status) يمنع تكرار نفس الحدث بالضبط — هذا استدعاء مكرر (idempotent)
    return { firstTime: false };
  }
}
