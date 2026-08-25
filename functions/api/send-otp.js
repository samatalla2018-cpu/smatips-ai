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
  if (await isOtpSendRateLimited(env.DB, phone, ip)) {
    await logEvent('otp_send_rate_limited', { phone });
    return jsonResponse({ error: 'محاولات كثيرة جدًا، حاول لاحقًا' }, 429);
  }

  await recordOtpSendAttempt(env.DB, phone, ip);

  const { ok, data, networkError } = await sendOtpViaAuthentica(env.AUTHENTICA_API_KEY, phone);
  if (!ok) {
    await logEvent('otp_send_failed', { phone, networkError, httpOk: ok });
    return jsonResponse({ error: data?.message || 'تعذّر إرسال رمز التحقق' }, 502);
  }

  await logEvent('otp_send_success', { phone });
  return jsonResponse({ success: true });
}
