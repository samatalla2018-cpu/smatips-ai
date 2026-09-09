// مصدر السعر المركزي في الواجهة — يُحمَّل مبكرًا (قبل أول عرض لأي بطاقة دفع) من /api/pricing
// العامة (بلا حاجة لجلسة، لأن بطاقة الدفع تُعرض للزائر أثناء المعاينة المجانية قبل تسجيل الدخول).
//
// المصدر الوحيد المعتمد فعليًا للمبلغ الحقيقي المُحصَّل: env.SUBSCRIPTION_PRICE_SAR على الخادم —
// نفس القيمة تُستخدم حرفيًا في كل من إنشاء فاتورة Moyasar (functions/api/payment/create.js) وطلب
// التحويل البنكي (functions/api/payment/bank-transfer/create.js)، فلا يوجد أي مصدر آخر أو متغيّر
// قديم يتحكّم بالمبلغ الفعلي. env.REGULAR_PRICE_SAR له دور واحد فقط: السعر الرسمي المشطوب المعروض
// للمقارنة (حاليًا 129 ريال) — لا يُستخدم إطلاقًا في أي حساب أو تحصيل مالي حقيقي.
//
// القيمتان أدناه احتياطيتان فقط (fallback) لو تعذّر الوصول للخادم لحظيًا؛ يجب أن تُطابقا القيمتين
// الحاليتين في Production (89 الفعلي / 129 المشطوب) حتى لا يظهر سعر خاطئ في حال فشل هذا الطلب فقط.
window.PRICING = { price_sar: 89, regular_price_sar: 129 };

async function loadPricing() {
  try {
    const res = await fetch('/api/pricing', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.price_sar) window.PRICING.price_sar = data.price_sar;
    if (data.regular_price_sar) window.PRICING.regular_price_sar = data.regular_price_sar;
  } catch {
    // نُبقي القيم الاحتياطية — لا نمنع عرض الصفحة بسبب فشل هذا الطلب.
  }
}

window.loadPricing = loadPricing;
