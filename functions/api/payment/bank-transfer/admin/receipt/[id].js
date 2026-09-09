import { jsonResponse, requireAdmin, getBankTransferRequestById } from '../../../../../_utils.js';

// يخدم ملف الإيصال مباشرة من R2 الخاص لهذا الطلب فقط — لا يوجد رابط عام دائم لأي إيصال؛ كل قراءة
// تتحقق من صلاحية Admin من جديد (requireAdmin سيرفر-side)، وليس فقط لأن الرابط "غير معروف".
export async function onRequestGet({ request, env, params }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  let reqRow;
  try {
    reqRow = await getBankTransferRequestById(env.DB, params.id);
  } catch {
    return jsonResponse({ error: 'تعذّر الوصول إلى الطلب' }, 503);
  }
  if (!reqRow || !reqRow.receipt_asset_key) return jsonResponse({ error: 'لا يوجد إيصال لهذا الطلب' }, 404);
  if (!env.RECEIPTS_BUCKET) return jsonResponse({ error: 'تخزين الإيصالات غير مُهيّأ بعد على الخادم' }, 500);

  const obj = await env.RECEIPTS_BUCKET.get(reqRow.receipt_asset_key);
  if (!obj) return jsonResponse({ error: 'الملف غير موجود' }, 404);

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
    },
  });
}
