import { jsonResponse, readSessionCookie, verifySessionToken, listTrips, createTrip } from '../../_utils.js';

// المصادقة فقط هنا — الدفع أصبح لكل رحلة (trip_id) وليس اشتراكًا عامًا للهاتف، لذا لم يعد
// عرض/إنشاء رحلاتك الخاصة يتطلب أن تكون قد دفعت مسبقًا؛ الدفع يُتحقّق لاحقًا لكل trip_id
// على حدة (عبر isTripUnlocked في trips/[id].js وميزة "رتّب لي اليوم من جديد"). لا يوجد أي
// تجاوز لأي رقم هاتف على مستوى الرحلة — الملكية وحدها لا تفتح رحلة غير مدفوعة.
async function requireAuthenticated(request, env) {
  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return { error: jsonResponse({ error: 'الجلسة غير صالحة' }, 401) };
  return { phone: session.phone };
}

export async function onRequestGet({ request, env }) {
  const { phone, error } = await requireAuthenticated(request, env);
  if (error) return error;
  let trips;
  try {
    trips = await listTrips(env.DB, phone);
  } catch {
    return jsonResponse({ error: 'تعذّر تحميل رحلاتك، حاول مرة أخرى' }, 503);
  }
  // unlocked يُحسب هنا على الخادم فقط من payment_status الحقيقي في D1 — الواجهة تعتمد على
  // هذا الحقل ولا تحسب الصلاحية بنفسها أبدًا، ولا يوجد أي تجاوز لأي رقم هاتف.
  const withUnlocked = trips.map((t) => ({ ...t, unlocked: t.payment_status === 'paid' }));
  return jsonResponse({ trips: withUnlocked });
}

export async function onRequestPost({ request, env }) {
  const { phone, error } = await requireAuthenticated(request, env);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'طلب غير صالح' }, 400);
  }

  const title = (body.title || 'رحلتي').trim().slice(0, 200);
  // html اختياري الآن: يسمح بإنشاء trip_id مبكرًا عند بدء التخطيط (بلا محتوى بعد) — أي قيمة
  // payment_status/paid واردة في الجسم تُتجاهل تمامًا؛ الخادم هو من يقرر أنها 'pending' دومًا.
  const html = body.html !== undefined ? body.html : '';
  if (typeof html !== 'string') return jsonResponse({ error: 'محتوى الملف غير صالح' }, 400);
  const MAX_TRIP_HTML_BYTES = 2 * 1024 * 1024; // 2MB — يمنع كتابة blobs غير محدودة الحجم
  if (html.length > MAX_TRIP_HTML_BYTES) return jsonResponse({ error: 'حجم الملف كبير جدًا' }, 413);

  let trip;
  try {
    trip = await createTrip(env.DB, phone, title, html);
  } catch {
    return jsonResponse({ error: 'تعذّر إنشاء الرحلة، حاول مرة أخرى' }, 503);
  }
  return jsonResponse({ trip });
}
