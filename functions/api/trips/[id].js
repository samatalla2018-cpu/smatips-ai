import {
  jsonResponse, readSessionCookie, verifySessionToken,
  getTripById, updateTripContent, isTripUnlocked,
} from '../../_utils.js';

// Endpoint محمي لتنزيل ملف رحلة واحد — يتحقق من الجلسة + أن الملف يخص نفس صاحب الجلسة + أن
// هذه الرحلة تحديدًا مدفوعة (payment_status='paid' في D1)، بدل التحقق القديم من اشتراك عام
// للهاتف كله. لا يوجد أي تجاوز لأي رقم هاتف — الملكية وحدها لا تكفي لفتح رحلة غير مدفوعة.
// لا يوجد رابط عام مباشر للملف في أي مكان آخر.
export async function onRequestGet({ request, env, params }) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'الجلسة غير صالحة' }, 401);

  let trip;
  try {
    trip = await getTripById(env.DB, params.id);
  } catch {
    return jsonResponse({ error: 'تعذّر الوصول إلى الملف' }, 503);
  }
  if (!trip || trip.phone !== session.phone) return jsonResponse({ error: 'الملف غير موجود' }, 403);
  if (!isTripUnlocked(trip)) return jsonResponse({ error: 'هذه الرحلة غير مدفوعة بعد' }, 403);

  return new Response(trip.html_content, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(trip.title)}.html"`,
    },
  });
}

// يحفظ محتوى/عنوان رحلة موجودة تخص صاحب الجلسة نفسه — بلا اشتراط دفع؛ حفظ مسودتك الخاصة
// يبقى مجانيًا دائمًا، والدفع يفتح فقط القراءة/التنزيل وميزة "رتّب لي اليوم من جديد".
export async function onRequestPut({ request, env, params }) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'الجلسة غير صالحة' }, 401);

  let existing;
  try {
    existing = await getTripById(env.DB, params.id);
  } catch {
    return jsonResponse({ error: 'تعذّر الوصول إلى الرحلة' }, 503);
  }
  if (!existing || existing.phone !== session.phone) return jsonResponse({ error: 'الرحلة غير موجودة' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'طلب غير صالح' }, 400);
  }

  const title = (body.title || existing.title || 'رحلتي').trim().slice(0, 200);
  const html = body.html;
  if (typeof html !== 'string') return jsonResponse({ error: 'محتوى الملف مطلوب' }, 400);
  const MAX_TRIP_HTML_BYTES = 2 * 1024 * 1024;
  if (html.length > MAX_TRIP_HTML_BYTES) return jsonResponse({ error: 'حجم الملف كبير جدًا' }, 413);

  try {
    await updateTripContent(env.DB, params.id, session.phone, title, html);
  } catch {
    return jsonResponse({ error: 'تعذّر حفظ الرحلة، حاول مرة أخرى' }, 503);
  }
  return jsonResponse({ trip: { id: params.id, title } });
}
