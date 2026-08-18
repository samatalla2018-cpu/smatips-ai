import { jsonResponse, readSessionCookie, verifySessionToken, getSubscriptionStatus, normalizePhone, listTrips, createTrip } from '../../_utils.js';

async function requireActiveSession(request, env) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return { error: jsonResponse({ error: 'الجلسة غير صالحة' }, 401) };
  const isOwner = env.ALLOWED_PHONE && session.phone === normalizePhone(env.ALLOWED_PHONE);
  if (isOwner) return { phone: session.phone };
  const status = await getSubscriptionStatus(env.DB, session.phone);
  if (status !== 'active') return { error: jsonResponse({ error: 'الاشتراك غير مفعّل' }, 403) };
  return { phone: session.phone };
}

export async function onRequestGet({ request, env }) {
  const { phone, error } = await requireActiveSession(request, env);
  if (error) return error;
  const trips = await listTrips(env.DB, phone);
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

  const title = (body.title || 'رحلتي').trim();
  const html = body.html;
  if (!html || typeof html !== 'string') return jsonResponse({ error: 'محتوى الملف مطلوب' }, 400);

  const trip = await createTrip(env.DB, phone, title, html);
  return jsonResponse({ trip });
}
