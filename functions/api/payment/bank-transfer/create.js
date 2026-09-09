import {
  jsonResponse, readSessionCookie, verifySessionToken, getTripById,
  getActiveBankTransferRequest, createBankTransferRequest,
} from '../../../_utils.js';
import { logEvent } from '../../../_log.js';

function bankConfigFromEnv(env) {
  return {
    bank_name: env.BANK_NAME || null,
    account_name: env.BANK_ACCOUNT_NAME || null,
    iban: env.BANK_IBAN || null,
  };
}

function shapeForClient(row, env) {
  return {
    order_number: row.order_number,
    trip_id: row.trip_id,
    status: row.status,
    regular_price_sar: row.regular_price_sar,
    amount_due_sar: row.amount_due_sar,
    created_at: row.created_at,
    ...bankConfigFromEnv(env),
  };
}

// ينشئ طلب تحويل بنكي جديد لرحلة محددة — السعر والحساب البنكي يأتيان من env السيرفر فقط (لا
// نثق بأي مبلغ يرسله المتصفح). إن وُجد طلب "نشط" (pending/under_review) لنفس trip_id، نعيده كما
// هو بدل إنشاء طلب مكرر — يمنع هذا التكرار عند إعادة فتح صفحة الدفع.
export async function onRequestPost({ request, env }) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'الجلسة غير صالحة، أعد تسجيل الدخول' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'طلب غير صالح' }, 400);
  }
  const tripId = body?.trip_id;
  if (!tripId || typeof tripId !== 'string') return jsonResponse({ error: 'trip_id مطلوب' }, 400);

  let trip;
  try {
    trip = await getTripById(env.DB, tripId);
  } catch {
    return jsonResponse({ error: 'تعذّر الوصول إلى الرحلة' }, 503);
  }
  if (!trip || trip.phone !== session.phone) return jsonResponse({ error: 'الرحلة غير موجودة' }, 403);
  if (trip.payment_status === 'paid') return jsonResponse({ error: 'هذه الرحلة مدفوعة بالفعل' }, 409);

  const amountDueSar = Number(env.SUBSCRIPTION_PRICE_SAR);
  const regularPriceSar = Number(env.REGULAR_PRICE_SAR) || amountDueSar;
  if (!amountDueSar || amountDueSar <= 0) {
    return jsonResponse({ error: 'سعر الرحلة غير مُهيّأ بعد على الخادم' }, 500);
  }
  if (!env.BANK_IBAN || !env.BANK_ACCOUNT_NAME || !env.BANK_NAME) {
    return jsonResponse({ error: 'التحويل البنكي غير مُهيّأ بعد على الخادم' }, 500);
  }

  const existing = await getActiveBankTransferRequest(env.DB, tripId);
  if (existing) {
    return jsonResponse({ request: shapeForClient(existing, env), already_exists: true });
  }

  let created;
  try {
    created = await createBankTransferRequest(env.DB, { tripId, phone: session.phone, regularPriceSar, amountDueSar });
  } catch {
    // على الأرجح تسابق طلبات (الفهرس الفريد الجزئي idx_btr_trip_active منع الإدراج) — نعيد ما
    // أصبح موجودًا الآن بدل فشل عام، وإلا نُبلغ بخطأ مؤقت حقيقي.
    const raced = await getActiveBankTransferRequest(env.DB, tripId);
    if (raced) return jsonResponse({ request: shapeForClient(raced, env), already_exists: true });
    return jsonResponse({ error: 'تعذّر إنشاء طلب التحويل، حاول مرة أخرى' }, 503);
  }

  await logEvent('bank_transfer_created', { phone: session.phone, tripId, requestId: created.id, orderNumber: created.order_number });
  return jsonResponse({ request: shapeForClient(created, env), already_exists: false });
}
