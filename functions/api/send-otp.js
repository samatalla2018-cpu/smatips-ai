import { jsonResponse, normalizePhone, sendOtpViaAuthentica, recordOtpSendAttempt, isOtpSendRateLimited, getClientIp } from '../_utils.js';
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

  if (!env.AUTHENTICA_API_KEY) {
    return jsonResponse({ error: 'خدمة التحقق غير مُهيّأة بعد على الخادم' }, 500);
  }

  const ip = getClientIp(request);

  // نمنع الإرسال المتكرر قبل استدعاء المزوّد — يحمي من استنزاف رصيد الرسائل ومن استخدام
  // نقطة الإرسال كأداة إزعاج (SMS bombing) لرقم لا يملكه المستخدم.
  // كلا استدعائي D1 هنا كانا بلا try/catch: أي عطل في القاعدة (جدول غير موجود، اتصال منقطع...)
  // كان يتحوّل إلى استثناء غير مُعالَج يخرج من هذه الدالة بلا استجابة JSON واضحة — قد يظهر للمتصفح
  // كطلب "معلّق" بلا نتيجة بدل خطأ صريح. الآن يفشل الطلب بأمان (503) برسالة واضحة دائمًا.
  let rateLimited;
  try {
    rateLimited = await isOtpSendRateLimited(env.DB, phone, ip);
  } catch {
    await logEvent('otp_send_rate_limit_check_failed', { phone });
    return jsonResponse({ error: 'تعذّر التحقق من محاولات الإرسال، حاول مرة أخرى' }, 503);
  }
  if (rateLimited) {
    await logEvent('otp_send_rate_limited', { phone });
    return jsonResponse({ error: 'محاولات كثيرة جدًا، حاول لاحقًا' }, 429);
  }

  try {
    await recordOtpSendAttempt(env.DB, phone, ip);
  } catch {
    await logEvent('otp_send_attempt_record_failed', { phone });
    return jsonResponse({ error: 'تعذّر إرسال رمز التحقق، حاول مرة أخرى' }, 503);
  }

  const { ok, data, networkError } = await sendOtpViaAuthentica(env.AUTHENTICA_API_KEY, phone);
  if (!ok) {
    await logEvent('otp_send_failed', { phone, networkError, httpOk: ok });
    return jsonResponse({ error: data?.message || 'تعذّر إرسال رمز التحقق' }, 502);
  }

  await logEvent('otp_send_success', { phone });
  return jsonResponse({ success: true });
}
