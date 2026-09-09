import { jsonResponse, readSessionCookie, verifySessionToken, getTripById, getLatestBankTransferRequestForTrip } from '../../../_utils.js';

// تُستخدم من صفحة الدفع/الرحلة لعرض حالة آخر طلب تحويل بنكي لهذه الرحلة (إن وُجد) دون الحاجة
// لإعادة إنشاء طلب جديد في كل مرة — لا تُرجع أبدًا receipt_asset_key (لا رابط عام دائم للإيصال).
export async function onRequestGet({ request, env }) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'الجلسة غير صالحة' }, 401);

  const url = new URL(request.url);
  const tripId = url.searchParams.get('trip_id');
  if (!tripId) return jsonResponse({ error: 'trip_id مطلوب' }, 400);

  let trip;
  try {
    trip = await getTripById(env.DB, tripId);
  } catch {
    return jsonResponse({ error: 'تعذّر الوصول إلى الرحلة' }, 503);
  }
  if (!trip || trip.phone !== session.phone) return jsonResponse({ error: 'الرحلة غير موجودة' }, 403);

  let row;
  try {
    row = await getLatestBankTransferRequestForTrip(env.DB, tripId);
  } catch {
    return jsonResponse({ error: 'تعذّر تحميل حالة الطلب' }, 503);
  }
  if (!row) return jsonResponse({ request: null });

  return jsonResponse({
    request: {
      order_number: row.order_number,
      status: row.status,
      regular_price_sar: row.regular_price_sar,
      amount_due_sar: row.amount_due_sar,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  });
}
