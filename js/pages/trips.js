// صفحة "رحلاتي" — ملفات الرحلة المحفوظة للعميل، تُبنى وتُحفظ من بيانات الرحلة الحالية وتُنزَّل عبر endpoint محمي

function tripFileItemHtml(t) {
  return `
    <div class="item-card" data-id="${t.id}">
      <div class="page-header-icon" style="width:34px;height:34px;border-radius:10px;">${icon('suitcase', 16)}</div>
      <div style="flex:1; min-width:0;">
        <div class="item-title">${escapeHtml(t.title)}</div>
        <div class="item-meta">
          <span class="badge">${escapeHtml(formatDateAr(new Date(t.created_at).toISOString().slice(0, 10)))}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="download" aria-label="تحميل">${icon('external', 14)}</button>
      </div>
    </div>`;
}

async function loadTripsList(listEl) {
  listEl.innerHTML = `<div class="flex items-center gap-2 text-sm text-muted" style="padding:20px 0;"><span class="spinner"></span><span>جارٍ تحميل رحلاتك المحفوظة...</span></div>`;
  try {
    const res = await fetch('/api/trips', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('failed');
    const { trips } = await res.json();
    listEl.innerHTML = trips.length ? trips.map(tripFileItemHtml).join('') : emptyState({
      iconName: 'suitcase',
      title: 'لا توجد ملفات رحلة محفوظة بعد',
      desc: 'اضغط "إنشاء ملف رحلة جديد" لحفظ نسخة قابلة للتنزيل من رحلتك الحالية.',
    });
    listEl.addEventListener('click', (e) => {
      const card = e.target.closest('[data-id]');
      if (!card || !e.target.closest('[data-action="download"]')) return;
      const trip = trips.find((t) => t.id === card.dataset.id);
      if (trip) downloadTripFile(trip.id, trip.title);
    });
  } catch {
    listEl.innerHTML = emptyState({ iconName: 'info', title: 'تعذّر تحميل رحلاتك', desc: 'حاول تحديث الصفحة.' });
  }
}

function renderTrips(container) {
  const hasCurrentTrip = !!store.getTrip().id;
  container.innerHTML = `
    ${pageHeader({
      title: 'رحلاتي',
      desc: 'ملفات رحلاتك المحفوظة — أنشئ نسخة جديدة أو نزّل واحدة سابقة في أي وقت',
      iconName: 'suitcase',
      actions: `<button class="btn btn-primary btn-sm" id="create-tripfile-btn">${icon('plus', 16)}<span>إنشاء ملف رحلة جديد</span></button>`,
    })}
    ${hasCurrentTrip ? `
    <div class="card mt-3 flex items-center gap-3">
      <div style="flex:1;">
        <div class="item-title">تبدأ رحلة أخرى؟</div>
        <div class="text-sm text-muted">ينهي هذا التخطيط الحالي في المتصفح ويبدأ رحلة جديدة بـ trip_id مستقل يحتاج دفعًا خاصًا به — رحلتك الحالية تبقى محفوظة إن كنت قد أنشأت ملفًا لها من قبل.</div>
      </div>
      <button class="btn btn-outline btn-sm" id="new-trip-btn">${icon('plus', 15)}<span>ابدأ رحلة جديدة</span></button>
    </div>` : ''}
    <div class="mt-3" id="trips-list"></div>
  `;

  const listEl = qs('#trips-list');
  loadTripsList(listEl);

  qs('#create-tripfile-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const trip = await saveAndDownloadTripFile();
    btn.disabled = false;
    if (trip) {
      toast('تم إنشاء ملف الرحلة وتنزيله', 'success');
      loadTripsList(listEl);
    }
  });

  const newTripBtn = qs('#new-trip-btn');
  if (newTripBtn) {
    newTripBtn.addEventListener('click', () => {
      if (!confirm('سيبدأ هذا تخطيط رحلة جديدة تمامًا في هذا المتصفح. هل تريد المتابعة؟')) return;
      store.resetAll();
      toast('يمكنك الآن البدء برحلة جديدة', 'success');
      navigate('/trip');
    });
  }
}

registerRoute('/trips', renderTrips);
