import {
  jsonResponse, normalizePhone, verifyOtpViaAuthentica, isOtpVerificationSuccessful,
  createSessionToken, ensureUserAndSubscription, recordOtpVerifyAttempt, isOtpVerifyRateLimited, getClientIp,
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
  const otp = (body.otp || '').trim();
  if (!phone || !otp) return jsonResponse({ error: 'بيانات ناقصة' }, 400);

  if (!env.AUTHENTICA_API_KEY) {
    return jsonResponse({ error: 'خدمة التحقق غير مُهيّأة بعد على الخادم' }, 500);
  }

  const ip = getClientIp(request);

  // يمنع تخمين رمز التحقق بالمحاولات المتكررة — يُطبَّق قبل حتى الاتصال بالمزوّد.
  // (بلا try/catch سابقًا: عطل D1 هنا كان استثناءً غير مُعالَج بلا استجابة JSON واضحة.)
  let rateLimited;
  try {
    rateLimited = await isOtpVerifyRateLimited(env.DB, phone);
  } catch {
    await logEvent('otp_verify_rate_limit_check_failed', { phone });
    return jsonResponse({ error: 'تعذّر التحقق من محاولاتك، حاول مرة أخرى' }, 503);
  }
  if (rateLimited) {
    await logEvent('otp_verify_rate_limited', { phone });
    return jsonResponse({ error: 'محاولات كثيرة جدًا، أعد إرسال الرمز وحاول لاحقًا' }, 429);
  }

  const { ok, data, networkError } = await verifyOtpViaAuthentica(env.AUTHENTICA_API_KEY, phone, otp);

  // بوابة القرار الوحيدة لإنشاء جلسة موثوقة: يجب أن يؤكد المزوّد النجاح صراحةً.
  // أي استجابة غامضة أو ناقصة أو خطأ شبكة/مهلة أو حالة HTTP غير متوقعة = رفض، دون استثناء.
  const verified = isOtpVerificationSuccessful(ok, data);

  try {
    await recordOtpVerifyAttempt(env.DB, phone, ip, verified);
  } catch {
    // فشل تسجيل المحاولة إحصائيًا فقط لا يجب أن يحوّل نتيجة تحقق حقيقية إلى استثناء غير مُعالَج —
    // القرار (verified) اتُّخذ بالفعل من رد المزوّد نفسه، وهذا السطر لا يغيّره في أي اتجاه.
    await logEvent('otp_verify_attempt_record_failed', { phone });
  }

  if (!verified) {
    await logEvent('otp_verify_failed', { phone, httpOk: ok, networkError, hadDataObject: !!data });
    return jsonResponse({ error: data?.message || 'رمز التحقق غير صحيح' }, 401);
  }

  try {
    await ensureUserAndSubscription(env.DB, phone);
  } catch {
    await logEvent('otp_verify_ensure_user_failed', { phone });
    return jsonResponse({ error: 'تعذّر إكمال تسجيل الدخول، حاول مرة أخرى' }, 503);
  }

  const token = await createSessionToken(env.SESSION_SECRET, phone);
  await logEvent('otp_verify_success_session_created', { phone });
  return jsonResponse(
    { success: true },
    200,
    { 'Set-Cookie': `smatrips_session=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax` }
  );
}
