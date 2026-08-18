import { jsonResponse, normalizePhone, verifyOtpViaAuthentica, createSessionToken } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'طلب غير صالح' }, 400);
  }

  const phone = normalizePhone(body.phone);
  const otp = (body.otp || '').trim();
  if (!phone || !otp) return jsonResponse({ error: 'بيانات ناقصة' }, 400);

  if (!env.ALLOWED_PHONE || phone !== normalizePhone(env.ALLOWED_PHONE)) {
    return jsonResponse({ error: 'هذا الرقم غير مصرح له بالدخول' }, 403);
  }

  const { ok, data } = await verifyOtpViaAuthentica(env.AUTHENTICA_API_KEY, phone, otp);
  if (!ok || data?.success === false) {
    return jsonResponse({ error: data?.message || 'رمز التحقق غير صحيح' }, 401);
  }

  const token = await createSessionToken(env.SESSION_SECRET);
  return jsonResponse(
    { success: true },
    200,
    { 'Set-Cookie': `smatrips_session=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax` }
  );
}
