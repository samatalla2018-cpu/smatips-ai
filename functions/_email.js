// إشعار بريدي بسيط للإدارة عند وصول طلب تحويل بنكي جديد يحتاج مراجعة. لا مكتبة/SDK خارجية —
// استدعاء fetch مباشر لواجهة Resend (https://resend.com) عبر REST API فقط، لتوافق كامل مع بيئة
// Cloudflare Pages Functions بلا أي حزمة (لا يوجد بناء/bundler في هذا المشروع أصلًا).
//
// اختياري بالكامل بالتصميم: إن لم يُضبط ADMIN_EMAIL أو RESEND_API_KEY، لا تُرسَل أي رسالة ولا
// يُعتبر ذلك خطأ — لا نخترع قيمًا افتراضية لهما. طلب التحويل نفسه يكون قد حُفظ بالفعل في D1 قبل
// استدعاء هذه الدالة دائمًا (راجع submit-proof.js) — فشل الإشعار لا يمسّ حفظ الطلب مطلقًا.
//
// اخترنا Resend تحديدًا لأنه الأبسط لهذا الاستخدام (REST بسيط، دون أي بوابة SMTP)، وله باقة مجانية
// كافية جدًا لحجم إشعارات إدارية فقط (وليس بريدًا جماعيًا). إن فُضِّل مزوّد آخر (SendGrid, Postmark,
// Mailgun...) التبديل بسيط لأن كل الاتصال هنا عبر fetch عادي فقط.
import { fetchWithTimeout } from './_utils.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// EMAIL_FROM اختياري: عنوان Resend التجريبي (sandbox) يعمل فورًا بلا أي إعداد نطاق من طرفنا —
// بديل معقول افتراضيًا وليس بيانات "مُخترَعة" لأنه فعليًا يعمل كما هو، لكن يُفضَّل استبداله ببريد
// من نطاق مُتحقَّق منه (SmaTrips AI الرسمي) عند توفره.
const DEFAULT_FROM = 'SmaTrips AI <onboarding@resend.dev>';

// لا تُرسل أبدًا بيانات حساسة أو صورة الإيصال نفسها — فقط تنبيه عام + رقم الطلب والمبلغ (بيانات
// تشغيلية غير شخصية) + رابط عادي للوحة الإدارة (ليس رابطًا سحريًا: الدخول إليه يتطلب نفس OTP +
// ADMIN_PHONES المعتادين تمامًا كما هما، هذا الاستدعاء لا يغيّر أو يتجاوز تلك الحماية بأي شكل).
export async function notifyAdminOfBankTransferRequest(env, { orderNumber, amountDueSar, adminUrl }) {
  if (!env.ADMIN_EMAIL || !env.RESEND_API_KEY) {
    return { sent: false, reason: 'not_configured' };
  }

  const fromAddress = env.EMAIL_FROM || DEFAULT_FROM;
  const html = `
    <p>وصل طلب تحويل بنكي جديد يحتاج مراجعة في SmaTrips AI.</p>
    <p>رقم الطلب: <b>${orderNumber}</b><br/>المبلغ: <b>${amountDueSar} ر.س</b></p>
    <p>راجعي الطلب من لوحة الإدارة: <a href="${adminUrl}">${adminUrl}</a></p>`;

  try {
    const res = await fetchWithTimeout(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: fromAddress,
        to: env.ADMIN_EMAIL,
        subject: `طلب تحويل بنكي جديد يحتاج مراجعة — ${orderNumber}`,
        html,
      }),
    }, 8000);
    return { sent: res.ok, status: res.status };
  } catch {
    return { sent: false, reason: 'network_error' };
  }
}
