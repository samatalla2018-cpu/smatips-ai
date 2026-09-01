import {
  jsonResponse, activateSubscriptionByInvoiceId, activateSubscriptionByPhone,
  activateTripPayment,
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
  const tripId = invoice.metadata?.trip_id;
  const amountSar = typeof invoice.amount === 'number' ? invoice.amount / 100 : null;

  if (!isPaid) {
    await recordPaymentEvent(env.DB, invoiceId, status, phone);
    return jsonResponse({ received: true });
  }

  // مهم: التفعيل يحدث أولًا، وسِجلّ payment_events (الذي يقرّر "مُعالَج من قبل أم لا") يُكتب فقط
  // بعد نجاحه فعليًا. لو عكسنا الترتيب (نسجّل الحدث ثم نفعّل)، وفشل التفعيل بسبب عطل مؤقت في D1،
  // سيُعامَل أي طلب ويبهوك لاحق لنفس الفاتورة كـ"مكرر" ويُتجاهَل — رغم أن التفعيل لم يتم فعليًا،
  // فيبقى العميل الذي دفع فعلاً عالقًا في status='pending' إلى الأبد دون أي محاولة تفعيل أخرى.
  // activateTripPayment/ByInvoiceId (ومثيلاتها للاشتراك القديم) هي UPDATE بسيطة وآمنة التكرار،
  // فإعادة تنفيذها عند إعادة إرسال Moyasar لنفس الحدث (بعد تعافي القاعدة) لا تُنتج أثرًا جانبيًا إضافيًا.
  //
  // الدفع أصبح لكل رحلة (trip_id في metadata) بدل اشتراك عام للهاتف. المسار البديل (بلا trip_id)
  // متروك فقط لأي فاتورة قديمة أُنشئت قبل هذا التعديل ولا تزال في الطريق (سيناريو نشر متزامن) —
  // كل فاتورة جديدة من الآن تحمل trip_id دائمًا (functions/api/payment/create.js).
  try {
    if (tripId) await activateTripPayment(env.DB, tripId, amountSar);
    else if (phone) await activateSubscriptionByPhone(env.DB, phone);
    else await activateSubscriptionByInvoiceId(env.DB, invoiceId);
  } catch {
    await logEvent('payment_activation_failed', { phone, tripId, invoiceId, status });
    return jsonResponse({ error: 'تعذّر تفعيل الدفع' }, 502);
  }

  const { firstTime } = await recordPaymentEvent(env.DB, invoiceId, status, phone);
  await logEvent(firstTime ? 'payment_activated' : 'payment_webhook_duplicate_ignored', { phone, tripId, invoiceId, status });

  return jsonResponse({ received: true });
}
