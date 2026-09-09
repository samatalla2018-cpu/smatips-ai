import {
  jsonResponse, readSessionCookie, verifySessionToken, getTripById,
  getActiveBankTransferRequest, submitBankTransferProof,
} from '../../../_utils.js';
import { logEvent } from '../../../_log.js';
import { notifyAdminOfBankTransferRequest } from '../../../_email.js';

const ALLOWED_RECEIPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

// يستقبل بيانات إثبات التحويل (اسم المحوّل إلزامي، رقم مرجع/ملاحظة اختياريان) + ملف الإيصال
// الاختياري، ويرفع الملف (إن وُجد) إلى R2 خاص — لا يوجد رابط عام دائم له، ولا يفتح هذا الاستدعاء
// الرحلة إطلاقًا؛ فقط يحوّل الطلب إلى under_review بانتظار اعتماد إداري صريح.
export async function onRequestPost({ request, env }) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'الجلسة غير صالحة، أعد تسجيل الدخول' }, 401);

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: 'طلب غير صالح' }, 400);
  }

  const tripId = form.get('trip_id');
  const senderName = (form.get('sender_name') || '').toString().trim().slice(0, 120);
  const referenceNumber = (form.get('reference_number') || '').toString().trim().slice(0, 120) || null;
  const note = (form.get('note') || '').toString().trim().slice(0, 500) || null;
  const file = form.get('receipt');

  if (!tripId || typeof tripId !== 'string') return jsonResponse({ error: 'trip_id مطلوب' }, 400);
  if (!senderName) return jsonResponse({ error: 'اسم المحوّل مطلوب' }, 400);

  let trip;
  try {
    trip = await getTripById(env.DB, tripId);
  } catch {
    return jsonResponse({ error: 'تعذّر الوصول إلى الرحلة' }, 503);
  }
  if (!trip || trip.phone !== session.phone) return jsonResponse({ error: 'الرحلة غير موجودة' }, 403);
  if (trip.payment_status === 'paid') return jsonResponse({ error: 'هذه الرحلة مدفوعة بالفعل' }, 409);

  const existing = await getActiveBankTransferRequest(env.DB, tripId);
  if (!existing) return jsonResponse({ error: 'لا يوجد طلب تحويل بنكي لهذه الرحلة، أنشئ طلبًا أولًا' }, 404);
  if (existing.status !== 'pending') {
    return jsonResponse({ error: 'تم إرسال إثبات التحويل لهذا الطلب بالفعل، بانتظار المراجعة' }, 409);
  }

  let receiptAssetKey = null;
  const hasFile = file && typeof file === 'object' && typeof file.arrayBuffer === 'function' && file.size > 0;
  if (hasFile) {
    if (!ALLOWED_RECEIPT_TYPES.has(file.type)) {
      return jsonResponse({ error: 'صيغة الملف غير مدعومة — JPG أو PNG أو WEBP أو PDF فقط' }, 400);
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      return jsonResponse({ error: 'حجم الملف أكبر من 5 ميجابايت' }, 413);
    }
    if (!env.RECEIPTS_BUCKET) {
      return jsonResponse({ error: 'تخزين الإيصالات غير مُهيّأ بعد على الخادم' }, 500);
    }
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1];
    receiptAssetKey = `receipts/${tripId}/${existing.id}-${Date.now()}.${ext}`;
    try {
      await env.RECEIPTS_BUCKET.put(receiptAssetKey, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
    } catch {
      return jsonResponse({ error: 'تعذّر رفع الإيصال، حاول مرة أخرى' }, 502);
    }
  }

  try {
    await submitBankTransferProof(env.DB, existing.id, { senderName, referenceNumber, receiptAssetKey, note });
  } catch {
    return jsonResponse({ error: 'تعذّر إرسال الطلب للمراجعة، حاول مرة أخرى' }, 503);
  }

  await logEvent('bank_transfer_submitted', { phone: session.phone, tripId, requestId: existing.id, hadReceipt: hasFile });

  // إشعار الإدارة اختياري تمامًا (ADMIN_EMAIL/RESEND_API_KEY) ولاحق لحفظ الطلب في D1 أعلاه — أي
  // فشل هنا (مزوّد بريد غير مُهيّأ، عطل شبكة...) لا يُعيد أي خطأ للعميل ولا يمسّ الطلب المحفوظ فعلًا.
  try {
    const notifyResult = await notifyAdminOfBankTransferRequest(env, {
      orderNumber: existing.order_number,
      amountDueSar: existing.amount_due_sar,
      adminUrl: `${new URL(request.url).origin}/admin/`,
    });
    await logEvent('bank_transfer_admin_notify', { requestId: existing.id, sent: notifyResult.sent, reason: notifyResult.reason });
  } catch {
    await logEvent('bank_transfer_admin_notify_failed', { requestId: existing.id });
  }

  return jsonResponse({ success: true, status: 'under_review', order_number: existing.order_number });
}
