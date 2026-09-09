// مكونات HTML قابلة لإعادة الاستخدام عبر الصفحات

function pageHeader({ title, desc, iconName, actions = '' }) {
  return `
    <div class="page-header">
      <div class="page-header-title-row">
        <div class="page-header-icon">${icon(iconName, 22)}</div>
        <div>
          <h1>${escapeHtml(title)}</h1>
          ${desc ? `<div class="desc">${escapeHtml(desc)}</div>` : ''}
        </div>
      </div>
      ${actions ? `<div class="flex gap-2">${actions}</div>` : ''}
    </div>`;
}

function emptyState({ iconName = 'info', title, desc, actionLabel, actionAttrs = '' }) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon(iconName, 26)}</div>
      <h3>${escapeHtml(title)}</h3>
      ${desc ? `<p>${escapeHtml(desc)}</p>` : ''}
      ${actionLabel ? `<button class="btn btn-primary btn-sm mt-2" ${actionAttrs}>${icon('plus', 16)}<span>${escapeHtml(actionLabel)}</span></button>` : ''}
    </div>`;
}

// بطاقة الدفع القياسية (Paywall) — نفس النسخة والتصميم أينما ظهرت (معاينة الرحلة، الجدول،
// الأماكن، الطقس...) حتى تكون رسالة السعر واحدة ومتّسقة في كل الموقع. السعر يأتي دائمًا من
// window.PRICING (مصدره النهائي env.SUBSCRIPTION_PRICE_SAR/env.REGULAR_PRICE_SAR على الخادم —
// راجع js/price.js)، وليس رقمًا مكتوبًا هنا. الزر يوجّه فقط إلى صفحة الدفع الموجودة
// (js/pages/pay.js) — لا يبدأ أي عملية دفع من هنا مباشرة.
function paywallCardHtml(tripId) {
  const price = window.PRICING.price_sar;
  const regularPrice = window.PRICING.regular_price_sar;
  const hasOffer = regularPrice && regularPrice > price;
  return `
    <div class="paywall-card" data-animate>
      <div class="paywall-icon">${icon('sparkle', 24)}</div>
      <h3>رحلتك جاهزة</h3>
      <p>افتح خطتك الكاملة وانطلق بكل التفاصيل بين يديك</p>
      ${hasOffer ? `<div class="text-sm text-muted" style="text-decoration:line-through;margin-top:14px;">${regularPrice} ر.س</div>` : ''}
      <div class="paywall-price">${price}<span> ريال للرحلة</span></div>
      ${hasOffer ? `<div class="badge badge-accent" style="margin-top:2px;">عرض الافتتاح لفترة محدودة</div>` : ''}
      <div class="paywall-price-note">دفعة واحدة لهذه الرحلة — بدون اشتراك</div>
      <a class="btn btn-pill btn-accent btn-block mt-2" href="#/pay?trip=${encodeURIComponent(tripId)}">${icon('wallet', 18)}<span>افتح رحلتي كاملة — ${price} ر.س</span></a>
      <ul class="paywall-unlocks">
        <li>${icon('check', 14)}<span>الجدول اليومي الكامل لجميع الأيام</span></li>
        <li>${icon('check', 14)}<span>جميع الأماكن والتوصيات</span></li>
        <li>${icon('check', 14)}<span>الطقس وتوقعات أيام الرحلة</span></li>
        <li>${icon('check', 14)}<span>المساعد الذكي للسفر</span></li>
        <li>${icon('check', 14)}<span>قائمة المهام</span></li>
        <li>${icon('check', 14)}<span>قائمة تجهيز الأغراض</span></li>
        <li>${icon('check', 14)}<span>العملات والمقابس والمعلومات المهمة</span></li>
        <li>${icon('check', 14)}<span>الروابط والحجوزات</span></li>
        <li>${icon('check', 14)}<span>حفظ الرحلة وتصديرها PDF</span></li>
      </ul>
    </div>`;
}

// شاشة قفل موحّدة لأي صفحة/قسم مدفوع بالكامل — تُستخدم في كل الأقسام التي تتحقق من
// getTripAccess (الجدول، الأماكن، الطقس، المهام، الأغراض، الروابط، العملات، المقابس، الخدمات).
// نفس بطاقة الـPaywall أعلاه، فوق رسالة قصيرة توضّح أن هذا القسم جزء من الخطة الكاملة — لا محتوى
// حقيقي يُعرض هنا أبدًا قبل تأكيد الدفع من السيرفر.
function lockedFeatureHtml({ iconName, title, desc, tripId }) {
  return `
    <div class="card" style="text-align:center; padding:36px 20px;" data-animate>
      <div class="page-header-icon" style="width:52px;height:52px;border-radius:16px;margin:0 auto 14px;">${icon(iconName, 24)}</div>
      <h3 style="font-size:16.5px; margin-bottom:6px;">${escapeHtml(title)}</h3>
      <p class="text-sm text-muted" style="max-width:380px; margin:0 auto;">${escapeHtml(desc)}</p>
    </div>
    ${paywallCardHtml(tripId)}
  `;
}

// صف مدمج لبقية الأيام المقفلة — عدد فقط بدل بطاقة منفصلة لكل يوم (يُستخدم في معاينة الرحلة
// المجانية أسفل يوم رحلتك الأول)
function lockedDaysListHtml(days) {
  if (!days.length) return '';
  return `
    <div class="locked-list-row" data-animate>
      ${icon('shield', 15)}
      <span>+${days.length} ${days.length === 1 ? 'يوم آخر مقفل' : 'أيام أخرى مقفلة'} — تُفتح فور الدفع</span>
    </div>`;
}

window.pageHeader = pageHeader;
window.emptyState = emptyState;
window.paywallCardHtml = paywallCardHtml;
window.lockedFeatureHtml = lockedFeatureHtml;
window.lockedDaysListHtml = lockedDaysListHtml;
