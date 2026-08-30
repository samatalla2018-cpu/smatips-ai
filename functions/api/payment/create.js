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
    // نسجّل حالة استجابة Moyasar ورسالتها الخام في السجلّات فقط (لتشخيص أخطاء بيانات
    // الاعتماد أو أي رفض آخر من المزوّد) — لا نسجّل أبدًا قيمة المفتاح نفسه. الرسالة
    // الخام لا تُرسل للعميل أبدًا؛ يرى المستخدم رسالة عربية عامة فقط بغضّ النظر عن السبب.
    await logEvent('payment_create_failed', { phone: session.phone, moyasarStatus: res.status, moyasarMessage: data?.message });
    return jsonResponse({ error: 'خدمة الدفع غير متاحة حاليًا، جرّب مرة أخرى لاحقًا.' }, 502);
  }

  await logEvent('payment_create_success', { phone: session.phone, invoiceId: data.id });
  // ربط رقم الفاتورة بالاشتراك هو تحسين تتبّع فقط — الفاتورة صالحة وقابلة للدفع عند Moyasar بغضّ
  // النظر عن نجاح هذه الكتابة، ولاحقًا سيفعّل الويبهوك الاشتراك عبر phone من بيانات الفاتورة نفسها
  // (metadata) بصرف النظر عن moyasar_invoice_id في D1. فشل هذه الكتابة يجب ألا يمنع المستخدم من
  // إكمال الدفع — نسجّل الخطأ ونكمل بدل رمي استثناء غير مُعالَج يُظهر خطأ تقني للمستخدم.
  try {
    await attachInvoiceToSubscription(env.DB, session.phone, data.id);
  } catch {
    await logEvent('payment_invoice_link_failed', { phone: session.phone, invoiceId: data.id });
  }

  return jsonResponse({ url: data.url });
}
