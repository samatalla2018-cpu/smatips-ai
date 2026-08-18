import { jsonResponse, activateSubscriptionByInvoiceId, activateSubscriptionByPhone } from '../../_utils.js';

// Moyasar ينادي هذا الرابط عند أحداث الدفع. التوثيق هنا عبر ?token= في رابط الـ webhook نفسه
// (وليس عبر ثقة بصفحة رجوع العميل) — القيمة تُقارَن بـ MOYASAR_WEBHOOK_SECRET.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!env.MOYASAR_WEBHOOK_SECRET || token !== env.MOYASAR_WEBHOOK_SECRET) {
    return jsonResponse({ error: 'غير مصرح' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'حمولة غير صالحة' }, 400);
  }

  // شكل حمولة Moyasar قد يختلف حسب نوع الحدث؛ نتعامل بمرونة مع أكثر من مسار محتمل لاستخراج
  // حالة الدفع، رقم الفاتورة، والهاتف — يُنصح بمراجعتها مقابل حمولة حقيقية أول مرة تُفعَّل فيها بيانات Moyasar الحقيقية.
  const payment = body.data || body;
  const status = payment.status || body.type || '';
  const isPaid = /paid|captured|success/i.test(status);
  const invoiceId = payment.invoice_id || payment.id || body.id;
  const phone = payment.metadata?.phone || body.metadata?.phone;

  if (isPaid) {
    if (invoiceId) await activateSubscriptionByInvoiceId(env.DB, invoiceId);
    else if (phone) await activateSubscriptionByPhone(env.DB, phone);
  }

  return jsonResponse({ received: true });
}
