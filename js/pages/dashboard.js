// لوحة التحكم الرئيسية — الصفحة الأولى التي يراها المستخدم بعد الدخول

const DESTINATION_IDEAS = [
  { name: 'إسطنبول', country: 'تركيا', img: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=500&auto=format&fit=crop' },
  { name: 'سانتوريني', country: 'اليونان', img: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=500&auto=format&fit=crop' },
  { name: 'جزر المالديف', country: 'المالديف', img: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?q=80&w=500&auto=format&fit=crop' },
  { name: 'باريس', country: 'فرنسا', img: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=500&auto=format&fit=crop' },
  { name: 'أجرا', country: 'الهند', img: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=500&auto=format&fit=crop' },
  { name: 'البندقية', country: 'إيطاليا', img: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=500&auto=format&fit=crop' },
];

function tripSummaryCard(trip) {
  const hasTrip = trip.country || trip.city || trip.startDate;
  // نظام الوجهة الديناميكية (js/destinations.js): يختار صورة وجو بصري مناسبَين لوجهة المستخدم
  // تلقائيًا — تزيين بصري بحت، لا علاقة له بحالة الدفع أو أي صلاحية.
  const theme = getDestinationTheme(trip);

  if (!hasTrip) {
    return `
      <div class="hero-banner is-fallback" data-animate>
        <img class="hero-banner-img" src="${theme.heroImage}" alt="" loading="eager" />
        <div class="hero-banner-scrim"></div>
        <div class="hero-banner-content">
          <span class="hero-eyebrow">${icon('sparkle', 15)}<span>مساعدك الذكي قبل السفر وأثناءه</span></span>
          <h2>وين نروح هالمرة؟ خلّنا نرتبها سوا</h2>
          <p class="hero-desc">جدولك اليومي، مهامك، أغراض السفر، الطقس والعملات… كل تفاصيل رحلتك القادمة في مكان واحد، تحسّها وكأنك بدأت فيها بالفعل.</p>
          <div class="hero-actions">
            <a href="#/trip" class="btn btn-pill btn-accent">${icon('plus', 18)}<span>ابدأ تخطيط رحلتي</span></a>
          </div>
        </div>
      </div>`;
  }

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
    <div class="hero-banner${theme.isFallback ? ' is-fallback' : ''}" data-animate>
      <img class="hero-banner-img" src="${theme.heroImage}" alt="" loading="eager" />
      <div class="hero-banner-scrim"></div>
      <a href="#/trip" class="hero-edit-btn" aria-label="تعديل بيانات الرحلة">${icon('edit', 16)}</a>
      <div class="hero-banner-content">
        <span class="hero-eyebrow">${icon('passport', 15)}<span>${escapeHtml(eyebrow)}</span></span>
        <h2>${escapeHtml(title)}</h2>
        ${dest ? `<div class="hero-meta">${icon('map', 15)}<span>${escapeHtml(dest)}</span></div>` : ''}
        ${trip.startDate ? `<div class="hero-meta">${icon('calendar', 15)}<span>${formatDateAr(trip.startDate)} ${trip.endDate ? '← ' + formatDateAr(trip.endDate) : ''}${days ? ` · ${days} ${days === 1 ? 'يوم' : 'أيام'}` : ''}</span></div>` : ''}
        <p class="hero-desc">جاهز لمغامرتك القادمة؟</p>

        <div class="hero-stats">
          <div class="hero-stat"><b>${doneTasks}/${tasks.length}</b><span>مهام منجزة</span></div>
          <div class="hero-stat"><b>${packedItems}/${packing.length}</b><span>أغراض مجهزة</span></div>
          <div class="hero-stat"><b>${places.length}</b><span>مكان محفوظ</span></div>
        </div>
      </div>
    </div>`;
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
