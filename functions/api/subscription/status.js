import { jsonResponse, readSessionCookie, verifySessionToken, getSubscriptionStatus } from '../../_utils.js';

export async function onRequestGet({ request, env }) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'الجلسة غير صالحة' }, 401);

  try {
    const status = await getSubscriptionStatus(env.DB, session.phone);
    // price_sar يُضاف هنا فقط ليقرأه العميل عند عرض شاشة الدفع لكل رحلة (js/pages/pay.js) —
    // بدل تكرار/تخمين السعر في JS، مصدر الحقيقة الوحيد يبقى env.SUBSCRIPTION_PRICE_SAR نفسه.
    const priceSar = Number(env.SUBSCRIPTION_PRICE_SAR) || null;
    return jsonResponse({ status, price_sar: priceSar });
  } catch {
    return jsonResponse({ error: 'تعذّر التحقق من الاشتراك' }, 503);
  }
}
