import { jsonResponse, requireAdmin, listBankTransferRequests } from '../../../../_utils.js';

// محمي بـ requireAdmin (تحقق سيرفر-side حقيقي عبر ADMIN_PHONES) — لا يعتمد على إخفاء هذا الرابط.
// لا يُرجع أبدًا receipt_asset_key نفسه؛ فقط has_receipt كإشارة لوجود ملف يُجلب عبر endpoint منفصل.
export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || null;

  let rows;
  try {
    rows = await listBankTransferRequests(env.DB, status);
  } catch {
    return jsonResponse({ error: 'تعذّر تحميل الطلبات' }, 503);
  }

  const requests = rows.map((r) => ({
    id: r.id,
    order_number: r.order_number,
    trip_id: r.trip_id,
    trip_title: r.trip_title,
    phone: r.phone,
    regular_price_sar: r.regular_price_sar,
    amount_due_sar: r.amount_due_sar,
    sender_name: r.sender_name,
    reference_number: r.reference_number,
    has_receipt: !!r.receipt_asset_key,
    note: r.note,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    reviewed_by: r.reviewed_by,
    reviewed_at: r.reviewed_at,
  }));
  return jsonResponse({ requests });
}
