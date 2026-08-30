import { jsonResponse, readSessionCookie, verifySessionToken, getSubscriptionStatus, normalizePhone, listTrips, createTrip } from '../../_utils.js';

async function requireActiveSession(request, env) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return { error: jsonResponse({ error: 'الجلسة غير صالحة' }, 401) };
  const isOwner = env.ALLOWED_PHONE && session.phone === normalizePhone(env.ALLOWED_PHONE);
  if (isOwner) return { phone: session.phone };
  let status;
  try {
    status = await getSubscriptionStatus(env.DB, session.phone);
  } catch {
    return { error: jsonResponse({ error: 'تعذّر التحقق من الاشتراك' }, 503) };
  }
  if (status !== 'active') return { error: jsonResponse({ error: 'الاشتراك غير مفعّل' }, 403) };
  return { phone: session.phone };
}

export async function onRequestGet({ request, env }) {
  const { phone, error } = await requireActiveSession(request, env);
  if (error) return error;
  let trips;
  try {
    trips = await listTrips(env.DB, phone);
  } catch {
    return jsonResponse({ error: 'تعذّر تحميل رحلاتك، حاول مرة أخرى' }, 503);
  }
  return jsonResponse({ trips });
}

export async function onRequestPost({ request, env }) {
  const { phone, error } = await requireActiveSession(request, env);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'طلب غير صالح' }, 400);
  }

  const title = (body.title || 'رحلتي').trim().slice(0, 200);
  const html = body.html;
  if (!html || typeof html !== 'string') return jsonResponse({ error: 'محتوى الملف مطلوب' }, 400);
  const MAX_TRIP_HTML_BYTES = 2 * 1024 * 1024; // 2MB — يمنع كتابة blobs غير محدودة الحجم
  if (html.length > MAX_TRIP_HTML_BYTES) return jsonResponse({ error: 'حجم الملف كبير جدًا' }, 413);

  let trip;
  try {
    trip = await createTrip(env.DB, phone, title, html);
  } catch {
    return jsonResponse({ error: 'تعذّر حفظ ملف الرحلة، حاول مرة أخرى' }, 503);
  }
  return jsonResponse({ trip });
}
