import { jsonResponse, normalizePhone, sendOtpViaAuthentica } from '../_utils.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'طلب غير صالح' }, 400);
  }

  const phone = normalizePhone(body.phone);
  if (!phone) return jsonResponse({ error: 'رقم الجوال مطلوب' }, 400);

  if (!env.ALLOWED_PHONE || phone !== normalizePhone(env.ALLOWED_PHONE)) {
    return jsonResponse({ error: 'هذا الرقم غير مصرح له بالدخول' }, 403);
  }

  if (!env.AUTHENTICA_API_KEY) {
    return jsonResponse({ error: 'خدمة التحقق غير مُهيّأة بعد على الخادم' }, 500);
  }

  const { ok, data } = await sendOtpViaAuthentica(env.AUTHENTICA_API_KEY, phone);
  if (!ok) {
    return jsonResponse({ error: data?.message || 'تعذّر إرسال رمز التحقق' }, 502);
  }

  return jsonResponse({ success: true });
}
