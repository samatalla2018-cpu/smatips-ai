// أدوات مشتركة لدوال Cloudflare Pages Functions: توقيع الجلسة + التواصل مع Authentica

const AUTHENTICA_BASE = 'https://api.authentica.sa/api/v1';

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

export async function sendOtpViaAuthentica(apiKey, phone) {
  const res = await fetch(`${AUTHENTICA_BASE}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Authorization': apiKey },
    body: JSON.stringify({ phone, method: 'sms' }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export async function verifyOtpViaAuthentica(apiKey, phone, otp) {
  const res = await fetch(`${AUTHENTICA_BASE}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Authorization': apiKey },
    body: JSON.stringify({ phone, otp }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
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
