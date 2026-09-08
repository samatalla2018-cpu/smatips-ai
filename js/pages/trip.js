// صفحة "رحلتي" — قبل trip_id: نموذج بدء الرحلة. بعد trip_id: صفحة تفاصيل رحلة (Hero + إحصاءات
// + معاينة يومية)، والنموذج القابل للتعديل يبقى كاملًا وفعّالًا أسفلها داخل قسم قابل للطي.

// بطاقة حالة الرحلة قبل وجود trip_id: زر "أنشئ خطتي" (يحجز trip_id من السيرفر) — بلا أي طلب دفع
// في هذه اللحظة؛ الدفع لا يظهر إلا لاحقًا في بطاقة المعاينة/Paywall. بعد trip_id تُبنى الحالة من
// GET /api/trips دومًا (لا نثق بأي حالة محفوظة محليًا) عبر refreshTripStatusCard.
function tripStatusCardHtml(trip) {
  if (!trip.id) {
    return `
      <div class="card mt-3" id="trip-status-card">
        <div class="flex items-center gap-3">
          <div class="page-header-icon" style="width:40px;height:40px;border-radius:12px;">${icon('sparkle', 18)}</div>
          <div style="flex:1;">
            <div class="item-title">جهّز بيانات رحلتك بالأسفل ثم أنشئ خطتك</div>
            <div class="text-sm text-muted">تقدر تبني جدولك وتشوف معاينة حقيقية لرحلتك قبل أي دفع</div>
          </div>
        </div>
        <button class="btn btn-primary btn-block mt-3" id="start-trip-btn">${icon('sparkle', 16)}<span>أنشئ خطتي</span></button>
      </div>`;
  }
  return '';
}

async function refreshTripStatusCard() {
  const trip = store.getTrip();
  const row = qs('#trip-status-row');
  if (!row || !trip.id) return;

  const access = await getTripAccess(trip.id);
  if (!access.found) {
    row.innerHTML = `<span class="text-sm text-muted">تعذّر العثور على هذه الرحلة على حسابك.</span>`;
  } else if (access.unlocked) {
    row.innerHTML = `
      <span class="badge badge-success">${icon('check', 12)}<span>مفتوحة بالكامل</span></span>
      <span class="text-sm text-muted">كل الأقسام والجدول الكامل والمساعد الذكي متاحة الآن</span>`;
  } else {
    row.innerHTML = `
      <span class="badge badge-info">نسخة تجريبية</span>
      <span class="text-sm text-muted">شاهد المعاينة بالأسفل، ثم افتح الخطة الكاملة وقتما تريد</span>`;
  }
  renderTripPreviewSection(access);
}

// ---------- معاينة الرحلة (Preview) قبل الدفع ----------
// تُبنى بالكامل من بيانات المستخدم المحلية الحقيقية — إن لم يُضِف أنشطة بعد، تظهر دعوة لإضافتها
// بدل التظاهر بوجود خطة جاهزة. اليوم الأول يظهر كاملًا، الثاني كلمحة مموّهة، والباقي مقفل بعدد فقط.
function previewActivityRowHtml(a) {
  const typeMeta = PLACE_TYPES.find((t) => t.id === a.type) || PLACE_TYPES[PLACE_TYPES.length - 1];
  return `
    <div class="timeline-item">
      <div class="timeline-dot">${icon(typeMeta.icon, 12)}</div>
      <div class="item-card" style="padding:10px;">
        <div style="flex:1; min-width:0;">
          <div class="item-title" style="font-size:13.5px;">${escapeHtml(a.title)}</div>
          <div class="item-meta">
            ${a.time ? `<span class="badge badge-primary">${escapeHtml(a.time)}</span>` : ''}
            <span class="badge">${escapeHtml(typeMeta.label)}</span>
          </div>
          ${a.notes ? `<div class="text-sm text-muted mt-1">${escapeHtml(a.notes)}</div>` : ''}
        </div>
      </div>
    </div>`;
}

// جملة ملخّص ذكي قصيرة — تُبنى محليًا من بيانات الرحلة الحقيقية (الوجهة، المدة، عدد المسافرين)،
// وليست استدعاء ذكاء اصطناعي حقيقيًا (لا يوجد Backend لذلك بعد). تزيينية بحتة، لا تُستخدم في أي قرار.
function tripSmartSummaryHtml(trip, theme, tripDays) {
  const destName = theme.key ? theme.label : (trip.city || trip.country || '');
  if (!destName) return '';
  const travelers = trip.travelers || 1;
  const parts = [`رحلتك إلى ${destName}`];
  if (tripDays) parts.push(`تمتد ${tripDays} ${tripDays === 1 ? 'يوم' : 'أيام'}`);
  parts.push(`لـ${travelers} ${travelers === 1 ? 'مسافر' : 'مسافرين'}`);
  const mood = theme.key || theme.region ? theme.mood : '';
  const sentence = parts.join(' ') + (mood ? ` — ${mood}.` : '.');
  return `<p class="trip-smart-summary" data-animate>${escapeHtml(sentence)}</p>`;
}

// معاينة ٢-٣ أماكن فقط من أماكن المستخدم الحقيقية المحفوظة (إن وُجدت) — بدون تفاصيل أو خرائط،
// فقط الاسم والنوع، بنفس تصميم بطاقات صفحة الأماكن حتى يشعر المستخدم أنها نفس الخطة الحقيقية.
function tripMiniPlacesHtml() {
  const places = store.list('places').slice(0, 3);
  if (!places.length) return '';
  return `
    <div class="section-title-row"><h2>أماكن في خطتك</h2></div>
    <div class="grid grid-3">
      ${places.map((p) => {
        const typeMeta = PLACE_TYPES.find((t) => t.id === p.type) || PLACE_TYPES[PLACE_TYPES.length - 1];
        return `
        <div class="place-card" style="pointer-events:none;">
          <div class="place-card-media pt-${typeMeta.id}" style="height:80px;">${icon(typeMeta.icon, 26)}</div>
          <div class="place-card-body" style="padding:10px;">
            <div class="place-card-name" style="font-size:12.5px;">${escapeHtml(p.name)}</div>
            <span class="badge badge-primary" style="font-size:10px;">${escapeHtml(typeMeta.label)}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// معاينة مصغّرة (عدد فقط) للمهام وأغراض السفر — وليست القائمة كاملة
function tripMiniTasksPackingHtml() {
  const tasks = store.list('tasks');
  const packing = store.list('packing');
  if (!tasks.length && !packing.length) return '';
  return `
    <div class="section-title-row"><h2>مهامك وأغراضك</h2></div>
    <div class="grid grid-2">
      <div class="card" style="text-align:center; padding:16px;">
        <div style="color:var(--success);">${icon('check', 22)}</div>
        <div class="font-bold mt-1">${tasks.length} ${tasks.length === 1 ? 'مهمة' : 'مهام'}</div>
        <div class="text-sm text-muted">تُفتح كاملة بعد الدفع</div>
      </div>
      <div class="card" style="text-align:center; padding:16px;">
        <div style="color:var(--accent-dark);">${icon('bag', 22)}</div>
        <div class="font-bold mt-1">${packing.length} ${packing.length === 1 ? 'غرض' : 'أغراض'}</div>
        <div class="text-sm text-muted">في قائمتك الحالية</div>
      </div>
    </div>`;
}

// ملخّص طقس اليوم الحالي فقط لوجهة الرحلة (وليس توقعات الأيام القادمة) — يُستدعى بعد إدراج
// tripPreviewSectionHtml في الصفحة لأنه يحتاج نداء شبكة حقيقيًا (نفس دوال weather.js).
async function loadTripMiniWeather(trip) {
  const host = qs('#trip-mini-weather');
  if (!host) return;
  const dest = trip.city || trip.country;
  if (!dest || typeof geocodeCity !== 'function') { host.remove(); return; }
  try {
    const geo = await geocodeCity(dest);
    if (!geo) { host.remove(); return; }
    const data = await fetchWeather(geo.lat, geo.lon, null, null);
    const cur = data.current;
    host.innerHTML = `
      <div class="section-title-row"><h2>طقس اليوم في وجهتك</h2></div>
      <a class="mini-weather-card" href="#/weather" data-animate>
        <span class="mini-weather-icon">${icon(weatherIconFor(cur.weather_code, cur.is_day), 30)}</span>
        <span class="mini-weather-info">
          <b>${Math.round(cur.temperature_2m)}°</b>
          <span class="text-sm text-muted">${escapeHtml(weatherCodeText(cur.weather_code))} · ${escapeHtml(geo.name)}</span>
        </span>
      </a>`;
    if (window.initAnimate) initAnimate(host);
  } catch {
    host.remove();
  }
}

function tripPreviewSectionHtml(trip) {
  const theme = getDestinationTheme(trip);
  const tripDays = daysBetween(trip.startDate, trip.endDate);
  const days = store.list('days').slice().sort((a, b) => (a.date > b.date ? 1 : -1));
  const activitiesOf = (d) => store.list('activities').filter((a) => a.dayId === d.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const summaryHtml = tripSmartSummaryHtml(trip, theme, tripDays);

  let day1Section;
  if (!days.length) {
    day1Section = `
      <div class="empty-state mt-3">
        <div class="empty-state-icon">${icon('calendar', 24)}</div>
        <h3>خطتك جاهزة تستقبل أول يوم</h3>
        <p>أضف تواريخ رحلتك بالأسفل أو ابنِ جدولك يدويًا لتظهر هنا معاينة حقيقية ليومك الأول قبل أي دفع.</p>
        <a class="btn btn-primary btn-sm mt-2" href="#/itinerary">${icon('plus', 15)}<span>ابنِ جدول رحلتك</span></a>
      </div>`;
  } else {
    const day1 = days[0];
    const day1Activities = activitiesOf(day1);
    day1Section = `
      <div class="section-title-row"><h2>اليوم الأول من خطتك</h2></div>
      <div class="card">
        <div class="font-bold" style="margin-bottom:10px;">${formatDateAr(day1.date)}${day1.title ? ' — ' + escapeHtml(day1.title) : ''}</div>
        ${day1Activities.length
          ? `<div class="timeline-list">${day1Activities.map(previewActivityRowHtml).join('')}</div>`
          : `<div class="empty-state" style="border:none; padding:22px 10px;">
               <div class="empty-state-icon">${icon('sparkle', 20)}</div>
               <h3>لم تُضِف أنشطة لليوم الأول بعد</h3>
               <p>أضف أول نشاط ليظهر هنا كمعاينة حقيقية لرحلتك</p>
               <a class="btn btn-primary btn-sm mt-2" href="#/itinerary">${icon('plus', 15)}<span>أضف أول نشاط</span></a>
             </div>`}
      </div>
      ${lockedDaysListHtml(days.slice(1))}`;
  }

  return `
    ${summaryHtml}
    ${day1Section}
    <div id="trip-mini-weather"></div>
    ${tripMiniPlacesHtml()}
    ${tripMiniTasksPackingHtml()}
    ${paywallCardHtml(trip.id)}
  `;
}

// يُستدعى بعد معرفة حالة الدفع الحقيقية (access): إن كانت الرحلة مفتوحة فعليًا يُخفي المعاينة/
// الدفع تمامًا ويعرض بدلها روابط الوصول الكاملة — لا تبقى شاشة "افتح خطتك" لرحلة مدفوعة بالفعل.
function renderTripPreviewSection(access) {
  const el = qs('#trip-preview-section');
  if (!el) return;
  if (access.unlocked) {
    el.innerHTML = `
      <div class="section-title-row"><h2>رحلتك مفتوحة بالكامل ✓</h2></div>
      <div class="grid grid-2">
        <a class="section-card-link" href="#/itinerary">
          <div class="section-card-icon" style="background:var(--info-light); color:var(--info);">${icon('calendar', 20)}</div>
          <div><div class="section-card-title">الجدول الكامل</div><div class="section-card-sub">كل أيامك وأنشطتك</div></div>
        </a>
        <a class="section-card-link" href="#/places">
          <div class="section-card-icon" style="background:var(--danger-light); color:var(--danger);">${icon('map', 20)}</div>
          <div><div class="section-card-title">الأماكن والخرائط</div><div class="section-card-sub">تفاصيل كاملة وروابط خرائط</div></div>
        </a>
        <a class="section-card-link" href="#/weather">
          <div class="section-card-icon" style="background:var(--sky-light); color:var(--sky-dark);">${icon('cloud', 20)}</div>
          <div><div class="section-card-title">الطقس الكامل</div><div class="section-card-sub">توقعات كل أيام رحلتك</div></div>
        </a>
        <a class="section-card-link" href="#/assistant">
          <div class="section-card-icon" style="background:var(--primary-light); color:var(--primary-dark);">${icon('sparkle', 20)}</div>
          <div><div class="section-card-title">مساعد السفر الذكي</div><div class="section-card-sub">اسأل عن أي تفصيل في رحلتك</div></div>
        </a>
        <a class="section-card-link" href="#/tasks">
          <div class="section-card-icon" style="background:var(--success-light); color:var(--success);">${icon('check', 20)}</div>
          <div><div class="section-card-title">المهام</div><div class="section-card-sub">كل ما يجب إنجازه</div></div>
        </a>
        <a class="section-card-link" href="#/packing">
          <div class="section-card-icon" style="background:var(--accent-light); color:var(--accent-dark);">${icon('bag', 20)}</div>
          <div><div class="section-card-title">قائمة الأغراض</div><div class="section-card-sub">لا تنسَ شيئًا</div></div>
        </a>
        <a class="section-card-link" href="#/links">
          <div class="section-card-icon" style="background:var(--primary-light); color:var(--primary-dark);">${icon('link', 20)}</div>
          <div><div class="section-card-title">الروابط والحجوزات</div><div class="section-card-sub">تذاكر، تأشيرة وتأمين</div></div>
        </a>
        <a class="section-card-link" href="#/currency">
          <div class="section-card-icon" style="background:var(--success-light); color:var(--success);">${icon('currency', 20)}</div>
          <div><div class="section-card-title">العملات والمقابس</div><div class="section-card-sub">تحويل فوري ومعلومات مهمة</div></div>
        </a>
        <a class="section-card-link" href="#/trips">
          <div class="section-card-icon" style="background:var(--accent-light); color:var(--accent-dark);">${icon('suitcase', 20)}</div>
          <div><div class="section-card-title">حفظ الرحلة وPDF</div><div class="section-card-sub">نزّل نسخة كاملة من رحلتك</div></div>
        </a>
      </div>`;
    if (window.initAnimate) initAnimate(el);
    return;
  }
  const trip = store.getTrip();
  el.innerHTML = tripPreviewSectionHtml(trip);
  if (window.initAnimate) initAnimate(el);
  loadTripMiniWeather(trip);
}

// ---------- Hero بانر ما قبل الإنشاء (لا وجهة نهائية بعد) ----------
function tripOnboardingBannerHtml(trip) {
  if (trip.id) return '';
  const theme = getDestinationTheme(trip);
  const destName = theme.key ? theme.label : (trip.city || trip.country || '');
  const title = destName ? `رحلتك إلى ${destName} تبدأ من هنا` : 'دوّن تفاصيل رحلتك وخلّها تصير حقيقة';
  return `
    <div class="hero-banner${theme.isFallback ? ' is-fallback' : ''}" id="trip-onboarding-hero" style="min-height:170px;margin-bottom:18px;" data-animate>
      <img class="hero-banner-img" src="${theme.heroImage}" alt="" loading="lazy" />
      <div class="hero-banner-scrim"></div>
      <div class="hero-banner-content">
        <span class="hero-eyebrow">${icon('passport', 15)}<span>${escapeHtml(theme.key || theme.region ? theme.mood : 'الخطوة الأولى')}</span></span>
        <h2 style="font-size:19px;">${escapeHtml(title)}</h2>
        <p class="hero-desc">الوجهة، التواريخ والميزانية — نبدأ منها نرتب كل شيء آخر.</p>
      </div>
    </div>`;
}

// يحدّث صورة/عنوان البانر الترحيبي فورًا أثناء الكتابة (قبل الحفظ) — إحساس فوري بأن الواجهة
// "تعرفت" على الوجهة، بلا أي إعادة تصيير للصفحة كاملة أو أي اتصال بالخادم.
function liveUpdateOnboardingHero(partialTrip) {
  const el = qs('#trip-onboarding-hero');
  if (!el) return;
  const trip = { ...store.getTrip(), ...partialTrip };
  const theme = getDestinationTheme(trip);
  const destName = theme.key ? theme.label : (trip.city || trip.country || '');
  const img = el.querySelector('.hero-banner-img');
  const eyebrowText = el.querySelector('.hero-eyebrow span');
  const h2 = el.querySelector('h2');
  if (img && img.src !== theme.heroImage) img.src = theme.heroImage;
  el.classList.toggle('is-fallback', !!theme.isFallback);
  if (eyebrowText) eyebrowText.textContent = theme.key || theme.region ? theme.mood : 'الخطوة الأولى';
  if (h2) h2.textContent = destName ? `رحلتك إلى ${destName} تبدأ من هنا` : 'دوّن تفاصيل رحلتك وخلّها تصير حقيقة';
}

// ---------- Hero + شريط إحصاءات "تفاصيل الرحلة" (بعد وجود trip_id) ----------
function tripDetailsHeroHtml(trip) {
  const theme = getDestinationTheme(trip);
  const dest = [trip.city, trip.country].filter(Boolean).join('، ');
  const destName = theme.key ? theme.label : (trip.city || trip.country || '');
  const title = trip.title || (destName ? `رحلتي إلى ${destName}` : 'رحلتي القادمة');
  return `
    <div class="hero-banner${theme.isFallback ? ' is-fallback' : ''}" id="trip-details-hero" style="margin-bottom:0;" data-animate>
      <img class="hero-banner-img" src="${theme.heroImage}" alt="" loading="eager" />
      <div class="hero-banner-scrim"></div>
      <div class="hero-banner-content">
        <span class="hero-eyebrow">${icon('sparkle', 15)}<span>${escapeHtml(theme.key || theme.region ? theme.mood : 'جاهز لمغامرتك القادمة؟')}</span></span>
        <h2 id="trip-details-title">${escapeHtml(title)}</h2>
        ${dest ? `<div class="hero-meta">${icon('map', 15)}<span>${escapeHtml(dest)}</span></div>` : ''}
      </div>
    </div>`;
}

function tripStatBarHtml(trip) {
  const days = daysBetween(trip.startDate, trip.endDate);
  const dateRange = trip.startDate
    ? `${formatDateAr(trip.startDate, { weekday: false, year: false })}${trip.endDate ? ' – ' + formatDateAr(trip.endDate, { weekday: false, year: false }) : ''}`
    : 'لم تُحدَّد بعد';
  const budgetText = trip.budget ? `${money(trip.budget)} ${escapeHtml(trip.currency || '')}` : 'غير محدَّدة';
  return `
    <div class="trip-stat-bar" id="trip-stat-bar" data-animate>
      <div class="trip-stat-bar-item">${icon('calendar', 18)}<b class="truncate">${escapeHtml(dateRange)}</b><span>التواريخ</span></div>
      <div class="trip-stat-bar-item">${icon('layers', 18)}<b>${days || '—'}</b><span>${days === 1 ? 'يوم' : 'أيام'}</span></div>
      <div class="trip-stat-bar-item">${icon('suitcase', 18)}<b>${trip.travelers || 1}</b><span>${(trip.travelers || 1) === 1 ? 'مسافر' : 'مسافرين'}</span></div>
      <div class="trip-stat-bar-item">${icon('wallet', 18)}<b class="truncate">${budgetText}</b><span>الميزانية</span></div>
    </div>`;
}

// يحدّث Hero وشريط الإحصاءات حيًا أثناء الكتابة في صفحة "تفاصيل الرحلة" (بعد trip_id) — بلا
// إعادة تصيير للصفحة كاملة، تمامًا بنفس فكرة liveUpdateOnboardingHero لحالة ما قبل الإنشاء.
function liveUpdateTripDetails(partialTrip) {
  const heroEl = qs('#trip-details-hero');
  if (!heroEl) return;
  const trip = { ...store.getTrip(), ...partialTrip };
  const theme = getDestinationTheme(trip);
  const destName = theme.key ? theme.label : (trip.city || trip.country || '');
  const img = heroEl.querySelector('.hero-banner-img');
  const eyebrowText = heroEl.querySelector('.hero-eyebrow span');
  const titleEl = qs('#trip-details-title');
  const metaEl = heroEl.querySelector('.hero-meta span');
  if (img && img.src !== theme.heroImage) img.src = theme.heroImage;
  heroEl.classList.toggle('is-fallback', !!theme.isFallback);
  if (eyebrowText) eyebrowText.textContent = theme.key || theme.region ? theme.mood : 'جاهز لمغامرتك القادمة؟';
  if (titleEl) titleEl.textContent = trip.title || (destName ? `رحلتي إلى ${destName}` : 'رحلتي القادمة');
  const dest = [trip.city, trip.country].filter(Boolean).join('، ');
  if (metaEl) metaEl.textContent = dest;

  const bar = qs('#trip-stat-bar');
  if (bar) bar.outerHTML = tripStatBarHtml(trip);
}

// ---------- نموذج بيانات الرحلة (مشترك بين حالتَي ما قبل/بعد الإنشاء) ----------
function tripFormHtml(trip) {
  return `
    <form id="trip-form" class="card flex-col gap-3">
      <div class="field">
        <label>اسم الرحلة (اختياري)</label>
        <input type="text" name="title" placeholder="مثال: رحلة الصيف إلى إسطنبول" value="${escapeHtml(trip.title)}" />
      </div>

      <div class="field-row">
        <div class="field">
          <label>الدولة</label>
          <input type="text" name="country" placeholder="مثال: تركيا" value="${escapeHtml(trip.country)}" />
        </div>
        <div class="field">
          <label>المدينة</label>
          <input type="text" name="city" placeholder="مثال: إسطنبول" value="${escapeHtml(trip.city)}" />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>تاريخ البداية</label>
          <input type="date" name="startDate" value="${escapeHtml(trip.startDate)}" />
        </div>
        <div class="field">
          <label>تاريخ النهاية</label>
          <input type="date" name="endDate" value="${escapeHtml(trip.endDate)}" />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>نوع الرحلة</label>
          <select name="tripType">
            <option value="">اختر النوع</option>
            ${TRIP_TYPES.map((t) => `<option value="${t}" ${trip.tripType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>عدد المسافرين</label>
          <input type="number" min="1" name="travelers" value="${escapeHtml(trip.travelers || 1)}" />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>الميزانية التقديرية</label>
          <input type="number" min="0" name="budget" placeholder="0" value="${escapeHtml(trip.budget)}" />
        </div>
        <div class="field">
          <label>العملة</label>
          <select name="currency">
            ${CURRENCIES.map((c) => `<option value="${c}" ${trip.currency === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="field">
        <label>ملاحظات عامة</label>
        <textarea name="notes" placeholder="أي تفاصيل إضافية تريد تذكّرها...">${escapeHtml(trip.notes)}</textarea>
      </div>

      <div class="flex gap-2 mt-1">
        <button type="submit" class="btn btn-primary">${icon('check', 16)}<span>حفظ البيانات</span></button>
        <span id="trip-save-hint" class="text-sm text-muted" style="align-self:center; opacity:0; transition:opacity .2s;">تم الحفظ ✓</span>
      </div>
    </form>`;
}

function wireTripForm(container) {
  const form = qs('#trip-form');
  const countryInput = form.querySelector('[name=country]');
  const cityInput = form.querySelector('[name=city]');
  const hasDetailsHero = !!qs('#trip-details-hero');
  const handleDestInput = debounce(() => {
    if (hasDetailsHero) {
      liveUpdateTripDetails({ country: countryInput.value, city: cityInput.value });
    } else {
      liveUpdateOnboardingHero({ country: countryInput.value, city: cityInput.value });
    }
  }, 250);
  countryInput.addEventListener('input', handleDestInput);
  cityInput.addEventListener('input', handleDestInput);

  function saveTripFormData() {
    const fd = new FormData(form);
    store.updateTrip({
      title: fd.get('title').trim(),
      country: fd.get('country').trim(),
      city: fd.get('city').trim(),
      startDate: fd.get('startDate'),
      endDate: fd.get('endDate'),
      tripType: fd.get('tripType'),
      travelers: Number(fd.get('travelers')) || 1,
      budget: fd.get('budget'),
      currency: fd.get('currency'),
      notes: fd.get('notes').trim(),
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveTripFormData();
    toast('تم حفظ بيانات الرحلة', 'success');
    if (hasDetailsHero) liveUpdateTripDetails(store.getTrip());
  });

  return { saveTripFormData };
}

function renderTrip(container) {
  const trip = store.getTrip();

  if (!trip.id) {
    container.innerHTML = `
      ${tripOnboardingBannerHtml(trip)}
      ${pageHeader({ title: 'بيانات الرحلة', desc: 'هذه البيانات تُستخدم في كل أنحاء الموقع', iconName: 'passport' })}
      ${tripStatusCardHtml(trip)}
      ${tripFormHtml(trip)}
      <div class="section-title-row"><h2>الخطوة التالية</h2></div>
      <div class="grid grid-2">
        <a class="section-card-link" href="#/itinerary">
          <div class="section-card-icon" style="background:var(--info-light); color:var(--info);">${icon('calendar', 20)}</div>
          <div>
            <div class="section-card-title">ابنِ جدول رحلتك</div>
            <div class="section-card-sub">وزّع الأنشطة على أيام رحلتك</div>
          </div>
        </a>
        <a class="section-card-link" href="#/packing">
          <div class="section-card-icon" style="background:var(--accent-light); color:var(--accent-dark);">${icon('bag', 20)}</div>
          <div>
            <div class="section-card-title">جهّز قائمة أغراضك</div>
            <div class="section-card-sub">لا تنسَ أي شيء مهم</div>
          </div>
        </a>
      </div>
    `;

    const { saveTripFormData } = wireTripForm(container);

    const startBtn = qs('#start-trip-btn');
    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true; startBtn.innerHTML = '<span>جارٍ الإنشاء...</span>';
      // نحفظ بيانات النموذج أولًا (الوجهة، التواريخ...) حتى تظهر خطة حقيقية في المعاينة فورًا
      // بعد الإنشاء، بدل الاعتماد على أن يضغط المستخدم "حفظ البيانات" في خطوة منفصلة.
      saveTripFormData();
      try {
        const res = await fetch('/api/trips', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: store.getTrip().title || 'رحلتي' }),
        });
        const data = await res.json();
        if (!res.ok || !data.trip) {
          toast(data.error || 'تعذّر إنشاء الرحلة', 'error');
          startBtn.disabled = false; startBtn.innerHTML = `${icon('sparkle', 16)}<span>أنشئ خطتي</span>`;
          return;
        }
        store.updateTrip({ id: data.trip.id });
        toast('تم إنشاء خطتك — هذي معاينتها', 'success');
        renderTrip(container);
      } catch {
        toast('تعذّر الاتصال بالخادم', 'error');
        startBtn.disabled = false; startBtn.innerHTML = `${icon('sparkle', 16)}<span>أنشئ خطتي</span>`;
      }
    });
    return;
  }

  // trip_id موجود: صفحة "تفاصيل الرحلة" أولًا (Hero + إحصاءات + معاينة يومية)، والنموذج القابل
  // للتعديل يبقى كاملًا وفعّالًا أسفلها داخل قسم قابل للطي (لا يحتاج أي جافاسكربت لفتحه/إغلاقه).
  container.innerHTML = `
    ${tripDetailsHeroHtml(trip)}
    ${tripStatBarHtml(trip)}
    <div class="flex items-center gap-2 mt-3" id="trip-status-row">
      <span class="spinner"></span><span class="text-sm text-muted">جارٍ التحقق من حالة رحلتك...</span>
    </div>
    <div id="trip-preview-section" class="mt-3"></div>
    <details class="trip-edit-details">
      <summary>${icon('edit', 16)}<span>تعديل بيانات الرحلة</span>${icon('chevronDown', 16, 'chev')}</summary>
      ${tripFormHtml(trip)}
    </details>
  `;

  wireTripForm(container);
  refreshTripStatusCard();
}

registerRoute('/trip', renderTrip);
