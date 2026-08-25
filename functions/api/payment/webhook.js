import {
  jsonResponse, activateSubscriptionByInvoiceId, activateSubscriptionByPhone,
  timingSafeEqual, getMoyasarInvoice, recordPaymentEvent,
} from '../../_utils.js';
import { logEvent } from '../../_log.js';

// Moyasar ينادي هذا الرابط عند أحداث الدفع. التوثيق هنا عبر ?token= في رابط الـ webhook نفسه
// (وليس عبر ثقة بصفحة رجوع العميل) — القيمة تُقارَن بـ MOYASAR_WEBHOOK_SECRET بزمن ثابت.
//
// مهم: لا نثق بحقل status/metadata الوارد في جسم طلب الويبهوك مباشرة — الجسم يُستخدم فقط
// لاستخراج معرّف الفاتورة، ثم نتحقق من حالتها الحقيقية عبر استدعاء خادم-إلى-خادم لـ Moyasar
// (getMoyasarInvoice). هذا يمنع تفعيل اشتراك بدفعة مزيّفة حتى لو تسرّب رابط الويبهوك.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  if (!env.MOYASAR_WEBHOOK_SECRET || !timingSafeEqual(token, env.MOYASAR_WEBHOOK_SECRET)) {
    return jsonResponse({ error: 'غير مصرح' }, 401);
  }

  if (!env.MOYASAR_SECRET_KEY) {
    return jsonResponse({ error: 'خدمة الدفع غير مُهيّأة بعد على الخادم' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'حمولة غير صالحة' }, 400);
  }

  const payloadHint = body.data || body;
  const invoiceId = payloadHint.invoice_id || payloadHint.id || body.id;
  if (!invoiceId || typeof invoiceId !== 'string') {
    return jsonResponse({ error: 'معرّف الفاتورة مفقود' }, 400);
  }

  const { ok, data: invoice } = await getMoyasarInvoice(env.MOYASAR_SECRET_KEY, invoiceId);
  if (!ok || !invoice) {
    // لا نُفعّل الاشتراك بلا تأكيد من المزوّد. نرجع خطأ (وليس 200) حتى تُعيد Moyasar محاولة الإرسال لاحقًا.
    await logEvent('payment_webhook_provider_verify_failed', { invoiceId });
    return jsonResponse({ error: 'تعذّر التحقق من الفاتورة لدى مزوّد الدفع' }, 502);
  }

  const status = String(invoice.status || '').toLowerCase();
  const isPaid = status === 'paid' || status === 'captured';
  const phone = invoice.metadata?.phone;

  const { firstTime } = await recordPaymentEvent(env.DB, invoiceId, status, phone);

  if (isPaid && firstTime) {
    if (phone) await activateSubscriptionByPhone(env.DB, phone);
    else await activateSubscriptionByInvoiceId(env.DB, invoiceId);
    await logEvent('payment_activated', { phone, invoiceId, status });
  } else if (isPaid) {
    await logEvent('payment_webhook_duplicate_ignored', { phone, invoiceId, status });
  }

  return jsonResponse({ received: true });
}
