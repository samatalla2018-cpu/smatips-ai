import { jsonResponse, requireAdmin, getBankTransferRequestById, rejectBankTransferRequest } from '../../../../_utils.js';
import { logEvent } from '../../../../_log.js';

// الرفض لا يمسّ trips.payment_status إطلاقًا (تبقى pending) — المستخدم يستطيع إنشاء طلب تحويل
// جديد لنفس trip_id لاحقًا (الفهرس الفريد الجزئي يسمح بذلك بمجرد ألا يبقى طلب "نشط" لنفس الرحلة).
export async function onRequestPost({ request, env }) {
  const { phone: adminPhone, error } = await requireAdmin(request, env);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'طلب غير صالح' }, 400);
  }
  const requestId = body?.request_id;
  if (!requestId || typeof requestId !== 'string') return jsonResponse({ error: 'request_id مطلوب' }, 400);

  let reqRow;
  try {
    reqRow = await getBankTransferRequestById(env.DB, requestId);
  } catch {
    return jsonResponse({ error: 'تعذّر الوصول إلى الطلب' }, 503);
  }
  if (!reqRow) return jsonResponse({ error: 'الطلب غير موجود' }, 404);
  if (reqRow.status !== 'under_review') {
    return jsonResponse({ error: 'هذا الطلب لم يعد بانتظار المراجعة' }, 409);
  }

  try {
    await rejectBankTransferRequest(env.DB, requestId, adminPhone);
  } catch {
    return jsonResponse({ error: 'تعذّر رفض التحويل، حاول مرة أخرى' }, 503);
  }

  await logEvent('bank_transfer_rejected', { phone: adminPhone, tripId: reqRow.trip_id, requestId });
  return jsonResponse({ success: true });
}
