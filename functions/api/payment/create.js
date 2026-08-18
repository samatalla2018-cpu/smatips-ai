import { jsonResponse, readSessionCookie, verifySessionToken, attachInvoiceToSubscription } from '../../_utils.js';

export async function onRequestPost({ request, env }) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'الجلسة غير صالحة، أعد تسجيل الدخول' }, 401);

  if (!env.MOYASAR_SECRET_KEY) {
    return jsonResponse({ error: 'خدمة الدفع غير مُهيّأة بعد على الخادم' }, 500);
  }

  const priceSar = Number(env.SUBSCRIPTION_PRICE_SAR);
  if (!priceSar || priceSar <= 0) {
    return jsonResponse({ error: 'سعر الاشتراك غير مُهيّأ بعد على الخادم' }, 500);
  }

  const origin = new URL(request.url).origin;
  const auth = btoa(`${env.MOYASAR_SECRET_KEY}:`);

  const res = await fetch('https://api.moyasar.com/v1/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
    body: JSON.stringify({
      amount: Math.round(priceSar * 100),
      currency: 'SAR',
      description: 'اشتراك SmaTrips AI مدى الحياة',
      callback_url: `${origin}/?payment=return`,
      metadata: { phone: session.phone },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id || !data.url) {
    return jsonResponse({ error: data?.message || 'تعذّر إنشاء عملية الدفع' }, 502);
  }

  await attachInvoiceToSubscription(env.DB, session.phone, data.id);

  return jsonResponse({ url: data.url });
}
