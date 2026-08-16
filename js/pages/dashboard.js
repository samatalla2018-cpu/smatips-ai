// لوحة التحكم الرئيسية

function tripSummaryCard(trip) {
  const hasTrip = trip.country || trip.city || trip.startDate;
  if (!hasTrip) {
    return `
      <div class="card" style="background:linear-gradient(135deg, var(--hero-from), var(--hero-to)); color:var(--text); border:none;">
        <div class="flex items-center gap-2" style="margin-bottom:8px;">
          ${icon('sparkle', 22)}
          <span class="badge" style="background:rgba(255,255,255,.75); color:var(--hero-accent);">ابدأ الآن</span>
        </div>
        <h2 style="font-size:19px; margin-bottom:6px; color:var(--text);">أهلًا بك في SmaTrips AI</h2>
        <p style="color:var(--text-muted); font-size:13.5px; max-width:520px;">أضف بيانات رحلتك الأولى — الوجهة والتواريخ ونوع الرحلة — وستجد كل تفاصيل سفرتك منظمة في مكان واحد.</p>
        <a href="#/trip" class="btn btn-sm mt-3" style="background:#fff; color:var(--hero-accent);">
          ${icon('plus', 16)}<span>إضافة بيانات الرحلة</span>
        </a>
      </div>`;
  }

  const days = daysBetween(trip.startDate, trip.endDate);
  const dest = [trip.city, trip.country].filter(Boolean).join('، ');
  const tasks = store.list('tasks');
  const doneTasks = tasks.filter((t) => t.done).length;
  const packing = store.list('packing');
  const packedItems = packing.filter((p) => p.packed).length;
  const places = store.list('places');

  return `
    <div class="card" style="background:linear-gradient(135deg, var(--hero-from), var(--hero-to)); color:var(--text); border:none;">
      <div class="flex items-center justify-between" style="margin-bottom:10px;">
        <div class="flex items-center gap-2">
          ${icon('passport', 20)}
          <span class="badge" style="background:rgba(255,255,255,.75); color:var(--hero-accent);">${escapeHtml(trip.tripType || 'رحلة')}</span>
        </div>
        <a href="#/trip" class="icon-btn" style="background:rgba(255,255,255,.75); border-color:rgba(255,255,255,.9); color:var(--hero-accent);">${icon('edit', 16)}</a>
      </div>
      <h2 style="font-size:20px; color:var(--text);">${escapeHtml(trip.title || 'رحلتي القادمة')}</h2>
      ${dest ? `<div class="flex items-center gap-1 mt-1" style="color:var(--text-muted); font-size:13.5px; font-weight:700;">${icon('map', 15)}<span>${escapeHtml(dest)}</span></div>` : ''}
      ${trip.startDate ? `<div class="flex items-center gap-1 mt-1" style="color:var(--text-muted); font-size:13.5px; font-weight:700;">${icon('calendar', 15)}<span>${formatDateAr(trip.startDate)} ${trip.endDate ? '← ' + formatDateAr(trip.endDate) : ''}${days ? ` · ${days} ${days === 1 ? 'يوم' : 'أيام'}` : ''}</span></div>` : ''}

      <div class="grid grid-3 mt-3" style="gap:10px;">
        <div style="background:var(--hero-soft-bg); border-radius:12px; padding:10px; text-align:center;">
          <div style="font-size:17px; font-weight:800; color:var(--text);">${doneTasks}/${tasks.length}</div>
          <div style="font-size:11px; color:var(--text-muted);">مهام منجزة</div>
        </div>
        <div style="background:var(--hero-soft-bg); border-radius:12px; padding:10px; text-align:center;">
          <div style="font-size:17px; font-weight:800; color:var(--text);">${packedItems}/${packing.length}</div>
          <div style="font-size:11px; color:var(--text-muted);">أغراض مجهزة</div>
        </div>
        <div style="background:var(--hero-soft-bg); border-radius:12px; padding:10px; text-align:center;">
          <div style="font-size:17px; font-weight:800; color:var(--text);">${places.length}</div>
          <div style="font-size:11px; color:var(--text-muted);">مكان محفوظ</div>
        </div>
      </div>
    </div>`;
}

function quickAccessGrid() {
  const items = SECTIONS.filter((s) => s.id !== 'dashboard');
  return `
    <div class="section-title-row">
      <h2>كل ما تحتاجه لرحلتك</h2>
    </div>
    <div class="grid grid-3">
      ${items.map((s) => `
        <a class="section-card-link" href="#${s.path}">
          <div class="section-card-icon" style="background:var(--${s.color}-light); color:var(--${s.color === 'primary' ? 'primary-dark' : s.color});">
            ${icon(s.icon, 21)}
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
    ${quickAccessGrid()}
  `;
}

registerRoute('/', renderDashboard);
