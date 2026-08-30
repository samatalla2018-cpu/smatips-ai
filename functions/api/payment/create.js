import { jsonResponse, readSessionCookie, verifySessionToken, attachInvoiceToSubscription, fetchWithTimeout } from '../../_utils.js';
import { logEvent } from '../../_log.js';

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
  // trim() يحمي من مسافة/سطر جديد ينتقل عرضًا عند نسخ المفتاح إلى إعدادات البيئة —
  // خطأ شائع يُترجم إلى "Invalid authorization credentials" من Moyasar رغم أن المفتاح صحيح.
  const auth = btoa(`${env.MOYASAR_SECRET_KEY.trim()}:`);

  let res;
  try {
    res = await fetchWithTimeout('https://api.moyasar.com/v1/invoices', {
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
  } catch {
    return jsonResponse({ error: 'تعذّر الاتصال بمزوّد الدفع' }, 502);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id || !data.url) {
    // لا نسجّل أبدًا قيمة المفتاح نفسه — فقط حالة استجابة Moyasar ورسالتها، لتشخيص أخطاء
    // بيانات الاعتماد (Invalid authorization credentials) أو أي رفض آخر من المزوّد.
    await logEvent('payment_create_failed', { phone: session.phone, moyasarStatus: res.status, moyasarMessage: data?.message });
    return jsonResponse({ error: data?.message || 'تعذّر إنشاء عملية الدفع' }, 502);
  }

  await logEvent('payment_create_success', { phone: session.phone, invoiceId: data.id });
  await attachInvoiceToSubscription(env.DB, session.phone, data.id);

  return jsonResponse({ url: data.url });
}
