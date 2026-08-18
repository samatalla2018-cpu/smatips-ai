// أدوات مشتركة لدوال Cloudflare Pages Functions: توقيع الجلسة + التواصل مع Authentica

const AUTHENTICA_BASE = 'https://api.authentica.sa/api/v1';

async function hmacSign(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createSessionToken(secret, days = 30) {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  const payload = btoa(JSON.stringify({ exp }));
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token, secret) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  try {
    const expectedSig = await hmacSign(secret, payload);
    if (sig !== expectedSig) return false;
    const data = JSON.parse(atob(payload));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
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
