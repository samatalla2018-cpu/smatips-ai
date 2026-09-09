import {
  jsonResponse, requireAdmin, getBankTransferRequestById, approveBankTransferRequest, activateTripPayment,
} from '../../../../_utils.js';
import { logEvent } from '../../../../_log.js';

// اعتماد صريح من Admin فقط. لا "Trip Pass" منفصل — الفتح الفعلي يمر عبر activateTripPayment()
// نفسها المستخدمة لتفعيل Moyasar، فتبقى isTripUnlocked() في _utils.js هي المصدر الوحيد للحقيقة.
// الشرط status === 'under_review' يمنع اعتماد نفس الطلب مرتين (409 في المحاولة الثانية).
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
    await approveBankTransferRequest(env.DB, requestId, adminPhone);
    await activateTripPayment(env.DB, reqRow.trip_id, reqRow.amount_due_sar);
  } catch {
    return jsonResponse({ error: 'تعذّر اعتماد التحويل، حاول مرة أخرى' }, 503);
  }

  await logEvent('bank_transfer_approved', { phone: adminPhone, tripId: reqRow.trip_id, requestId });
  return jsonResponse({ success: true });
}
