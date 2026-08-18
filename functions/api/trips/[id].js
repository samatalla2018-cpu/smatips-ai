import { jsonResponse, readSessionCookie, verifySessionToken, getSubscriptionStatus, getTripById } from '../../_utils.js';

// Endpoint محمي لتنزيل ملف رحلة واحد — يتحقق من الجلسة + الاشتراك + أن الملف يخص نفس صاحب الجلسة
// قبل إرجاع أي محتوى. لا يوجد رابط عام مباشر للملف في أي مكان آخر.
export async function onRequestGet({ request, env, params }) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'الجلسة غير صالحة' }, 401);

  const status = await getSubscriptionStatus(env.DB, session.phone);
  if (status !== 'active') return jsonResponse({ error: 'الاشتراك غير مفعّل' }, 403);

  const trip = await getTripById(env.DB, params.id);
  if (!trip || trip.phone !== session.phone) return jsonResponse({ error: 'الملف غير موجود' }, 403);

  return new Response(trip.html_content, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(trip.title)}.html"`,
    },
  });
}
