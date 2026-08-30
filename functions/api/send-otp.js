// تسجيل دخول فوري برقم الجوال — تم إلغاء خطوة التحقق عبر رمز SMS/OTP بالكامل بقرار المنتج.
// أي رقم جوال صالح يُنشئ جلسة موثوقة مباشرة، دون تحقق فعلي من ملكية الرقم.

import {
  jsonResponse, normalizePhone, createSessionToken, ensureUserAndSubscription,
  recordOtpSendAttempt, isOtpSendRateLimited, getClientIp,
} from '../_utils.js';
import { logEvent } from '../_log.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'طلب غير صالح' }, 400);
  }

  const phone = normalizePhone(body.phone);
  if (!phone) return jsonResponse({ error: 'رقم الجوال مطلوب' }, 400);

  const ip = getClientIp(request);

  if (await isOtpSendRateLimited(env.DB, phone, ip)) {
    await logEvent('login_rate_limited', { phone });
    return jsonResponse({ error: 'محاولات كثيرة جدًا، حاول لاحقًا' }, 429);
  }

  await recordOtpSendAttempt(env.DB, phone, ip);
  await ensureUserAndSubscription(env.DB, phone);

  const token = await createSessionToken(env.SESSION_SECRET, phone);
  await logEvent('login_session_created', { phone });
  return jsonResponse(
    { success: true },
    200,
    { 'Set-Cookie': `smatrips_session=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax` }
  );
}
