// لوحة التحكم الرئيسية — الصفحة الأولى التي يراها المستخدم بعد الدخول

const DESTINATION_IDEAS = [
  { name: 'إسطنبول', country: 'تركيا', img: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=500&auto=format&fit=crop' },
  { name: 'سانتوريني', country: 'اليونان', img: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=500&auto=format&fit=crop' },
  { name: 'جزر المالديف', country: 'المالديف', img: '/assets/hero/maldives-default.jpg' },
  { name: 'باريس', country: 'فرنسا', img: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=500&auto=format&fit=crop' },
  { name: 'أجرا', country: 'الهند', img: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=500&auto=format&fit=crop' },
  { name: 'البندقية', country: 'إيطاليا', img: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=500&auto=format&fit=crop' },
];

// ---------- Hero (مرحلة الإلهام — قبل وجود أي رحلة) ----------
// صورة ثابتة واحدة قوية (المالديف) بدل شرائح متبدّلة — بطلب صريح: صورة Premium ثابتة أوضح
// وأقوى بصريًا من تبديل/حركة قد تُضعف التصميم. من نفس مصدر صور الوجهات الموجود مسبقًا
// (js/destinations.js DESTINATION_THEMES) — لا خدمة صور جديدة، فقط حجم أكبر (w=1920) يناسب
// صورة وحيدة تحمل كل ثقل الـHero بدل عدة صور متوسطة الحجم.
function heroSlideUrl(baseUrl) {
  return baseUrl.replace(/([?&])w=\d+/, `$1w=1920`);
}

function inspirationHeroHtml() {
  return `
    <div class="mega-hero" data-animate>
      <img class="mega-hero-img" src="${heroSlideUrl(DESTINATION_THEMES.maldives.heroImage)}" alt="" loading="eager" fetchpriority="high" />
      <div class="mega-hero-scrim"></div>
      <div class="mega-hero-content">
        <h1>رحلتك تبدأ من هنا</h1>
        <p>خطط رحلتك بذكاء، وخلي SmaTrips يرتب لك التفاصيل.</p>
        <a href="#/trip" class="btn btn-pill btn-accent">${icon('sparkle', 18)}<span>ابدأ التخطيط الآن</span></a>
        <div class="mega-hero-chips">
          <span class="mega-hero-chip">${icon('sparkle', 13)}<span>خطتك بالذكاء الاصطناعي</span></span>
          <span class="mega-hero-chip">${icon('layers', 13)}<span>كل تفاصيل رحلتك في مكان واحد</span></span>
        </div>
      </div>
    </div>`;
}

// ---------- Hero الشخصي (بعد اختيار وجهة/تواريخ) — نفس بيانات الرحلة الحقيقية كما كانت تمامًا ----------
function personalizedHeroHtml(trip) {
  // نظام الوجهة الديناميكية (js/destinations.js): يختار صورة وجو بصري مناسبَين لوجهة المستخدم
  // تلقائيًا — تزيين بصري بحت، لا علاقة له بحالة الدفع أو أي صلاحية. لا بيانات طقس/أرقام وهمية هنا.
  const theme = getDestinationTheme(trip);
  const days = daysBetween(trip.startDate, trip.endDate);
  const dest = [trip.city, trip.country].filter(Boolean).join('، ');
  const tasks = store.list('tasks');
  const doneTasks = tasks.filter((t) => t.done).length;
  const packing = store.list('packing');
  const packedItems = packing.filter((p) => p.packed).length;
  const places = store.list('places');

  // إن عرفنا الوجهة ولم يضع المستخدم عنوانًا خاصًا لرحلته، يصبح العنوان "رحلتي إلى [الوجهة]"
  // تلقائيًا (الشعور الفوري بالتخصيص) — أي عنوان كتبه المستخدم بنفسه يبقى كما هو دائمًا.
  const destName = theme.key ? theme.label : (trip.city || trip.country || '');
  const title = trip.title || (destName ? `رحلتي إلى ${destName}` : 'رحلتي القادمة');
  const eyebrow = theme.key || theme.region ? theme.mood : (trip.tripType || 'رحلتك القادمة');

  return `
    <div class="mega-hero mega-hero-personal${theme.isFallback ? ' is-fallback' : ''}" data-animate>
      <img class="mega-hero-img" src="${heroSlideUrl(theme.heroImage)}" alt="" loading="eager" fetchpriority="high" />
      <div class="mega-hero-scrim"></div>
      <a href="#/trip" class="hero-edit-btn" aria-label="تعديل بيانات الرحلة">${icon('edit', 16)}</a>
      <div class="mega-hero-content">
        <span class="mega-hero-dest-tag">${icon('passport', 13)}<span>${escapeHtml(eyebrow)}</span></span>
        <h1>${escapeHtml(title)}</h1>
        ${dest ? `<div class="hero-meta">${icon('map', 15)}<span>${escapeHtml(dest)}</span></div>` : ''}
        ${trip.startDate ? `<div class="hero-meta">${icon('calendar', 15)}<span>${formatDateAr(trip.startDate)} ${trip.endDate ? '← ' + formatDateAr(trip.endDate) : ''}${days ? ` · ${days} ${days === 1 ? 'يوم' : 'أيام'}` : ''}</span></div>` : ''}
        <div class="hero-meta">${icon('suitcase', 15)}<span>${trip.travelers || 1} ${(trip.travelers || 1) === 1 ? 'مسافر' : 'مسافرين'}</span></div>
        ${trip.budget ? `<div class="hero-meta">${icon('wallet', 15)}<span>${money(trip.budget)} ${escapeHtml(trip.currency || '')}</span></div>` : ''}

        <div class="hero-stats">
          <div class="hero-stat"><b>${doneTasks}/${tasks.length}</b><span>مهام منجزة</span></div>
          <div class="hero-stat"><b>${packedItems}/${packing.length}</b><span>أغراض مجهزة</span></div>
          <div class="hero-stat"><b>${places.length}</b><span>مكان محفوظ</span></div>
        </div>
      </div>
    </div>`;
}

function tripSummaryCard(trip) {
  const hasTrip = trip.country || trip.city || trip.startDate;
  return hasTrip ? personalizedHeroHtml(trip) : inspirationHeroHtml();
}

// أزرار وصول سريع مضغوطة (٤ فقط) لأكثر أقسام الرحلة استخدامًا — تظهر أسفل البطاقة الرئيسية
// مباشرة بمجرد وجود رحلة، بدل قائمة طويلة بكل الأقسام. باقي الأقسام تبقى متاحة عبر "المزيد".
const QUICK_ACTION_IDS = ['itinerary', 'places', 'weather', 'assistant'];
function quickActionsRow(trip) {
  if (!trip.id) return '';
  const items = QUICK_ACTION_IDS.map((id) => SECTIONS.find((s) => s.id === id)).filter(Boolean);
  return `
    <div class="quick-actions-row" data-animate>
      ${items.map((s) => `
        <a class="quick-action-item" href="#${s.path}">
          <span class="quick-action-icon">${icon(s.icon, 22)}</span>
          <span>${escapeHtml(s.short)}</span>
        </a>`).join('')}
    </div>`;
}

// بطاقة "معاينة رحلتك" — دعوة أنيقة لفتح صفحة تفاصيل الوجهة الكاملة (Destination Details)،
// بصورة الوجهة نفسها ووصف قصير، بدل تكرار كل محتوى تلك الصفحة هنا.
function tripPreviewPromptCard(trip) {
  if (!trip.id) return '';
  const theme = getDestinationTheme(trip);
  const destName = theme.key ? theme.label : (trip.city || trip.country || 'رحلتك');
  const days = daysBetween(trip.startDate, trip.endDate);
  const desc = destName
    ? `تعرف على وجهتك، شاهد يومك الأول، والطقس، وأهم الأماكن — كل التفاصيل في مكان واحد.`
    : 'أكمل بيانات رحلتك لتظهر هنا معاينة كاملة لوجهتك.';
  return `
    <div class="section-title-row"><h2>معاينة رحلتك</h2></div>
    <a class="dest-details-card" href="#/trip" data-animate>
      <img class="dest-details-img" src="${theme.cardImage}" alt="" loading="lazy" />
      <div class="dest-details-scrim"></div>
      <div class="dest-details-body">
        <div class="dest-details-title">${escapeHtml(destName || 'رحلتك القادمة')}</div>
        <p class="dest-details-desc">${escapeHtml(desc)}</p>
        <div class="dest-details-meta">
          ${days ? `<span>${icon('layers', 14)}${days} ${days === 1 ? 'يوم' : 'أيام'}</span>` : ''}
          <span>${icon('suitcase', 14)}${trip.travelers || 1} ${(trip.travelers || 1) === 1 ? 'مسافر' : 'مسافرين'}</span>
        </div>
      </div>
      <span class="dest-details-cta">${icon('chevron', 18)}</span>
    </a>`;
}

function destinationIdeasStrip() {
  return `
    <div class="section-title-row">
      <h2>وجهات مقترحة</h2>
    </div>
    <div class="dest-strip">
      ${DESTINATION_IDEAS.map((d, i) => `
        <a class="dest-card" href="#/trip" data-animate style="transition-delay:${Math.min(i * 60, 240)}ms">
          <img src="${d.img}" alt="${escapeHtml(d.name)}" loading="lazy" />
          <div class="dest-card-scrim"></div>
          <div class="dest-card-info">
            <div class="dest-card-name">${escapeHtml(d.name)}</div>
            <div class="dest-card-country">${escapeHtml(d.country)}</div>
          </div>
        </a>`).join('')}
    </div>`;
}

// بقية الأقسام (غير الأربعة في الوصول السريع) — تبقى مرئية هنا بشكل مختصر بدل الاختفاء
// بالكامل خلف "المزيد"، مع استثناء "بيانات الرحلة" لأن بطاقة الهيرو أعلاه تفتحها مباشرة.
const MORE_TOOLS_IDS = ['tasks', 'packing', 'currency', 'plugs', 'links', 'services', 'trips'];
function moreToolsGrid() {
  const items = MORE_TOOLS_IDS.map((id) => SECTIONS.find((s) => s.id === id)).filter(Boolean);
  return `
    <div class="section-title-row">
      <h2>أدوات رحلتك</h2>
    </div>
    <div class="grid grid-3">
      ${items.map((s, i) => `
        <a class="section-card-link" href="#${s.path}" data-animate style="transition-delay:${Math.min(i * 40, 200)}ms">
          <div class="section-card-icon" style="background:var(--${s.color}-light); color:var(--${s.color === 'primary' ? 'primary-dark' : s.color === 'info' ? 'sky-dark' : s.color === 'accent' ? 'accent-dark' : s.color});">
            ${icon(s.icon, 22)}
          </div>
          <div>
            <div class="section-card-title">${escapeHtml(s.title)}</div>
            <div class="section-card-sub">${escapeHtml(s.desc || '')}</div>
          </div>
        </a>`).join('')}
    </div>`;
}

function renderDashboard(container) {
  const trip = store.getTrip();
  container.innerHTML = `
    ${tripSummaryCard(trip)}
    ${quickActionsRow(trip)}
    ${tripPreviewPromptCard(trip)}
    ${destinationIdeasStrip()}
    ${moreToolsGrid()}
  `;
}

registerRoute('/', renderDashboard);
