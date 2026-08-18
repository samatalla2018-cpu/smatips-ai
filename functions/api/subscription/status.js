import { jsonResponse, readSessionCookie, verifySessionToken, getSubscriptionStatus } from '../../_utils.js';

export async function onRequestGet({ request, env }) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'الجلسة غير صالحة' }, 401);

  const status = await getSubscriptionStatus(env.DB, session.phone);
  return jsonResponse({ status });
}
