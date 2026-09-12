// صفحة "رحلاتي" — ملفات الرحلة المحفوظة للعميل، تُبنى وتُحفظ من بيانات الرحلة الحالية وتُنزَّل عبر endpoint محمي

let tripsTabFilter = 'الكل';

// ملاحظة عن صور بطاقات "رحلاتي": GET /api/trips لا يُرجع مدينة/دولة كل رحلة (فقط id/title/
// payment_status/created_at) — لذا لا نملك بيانات وجهة حقيقية إلا للرحلة المحمَّلة حاليًا في
// هذا المتصفح (store.getTrip()). نعرض صورة الوجهة الحقيقية فقط لتلك الرحلة تحديدًا، وصورة
// SmaTrips الاحتياطية الأنيقة لبقية الرحلات — بدل تخمين وجهة قد تكون خاطئة تمامًا.
function tripCardTheme(t) {
  const current = store.getTrip();
  if (t.id === current.id) return getDestinationTheme(current);
  return getDestinationTheme(null);
}

function tripCardHtml(t, i) {
  const theme = tripCardTheme(t);
  const createdDate = formatDateAr(new Date(t.created_at).toISOString().slice(0, 10), { weekday: false, year: false });
  // الرحلة الحالية المحمَّلة في هذا المتصفح تُفتح على معاينتها الحقيقية (بيانات محلية صحيحة).
  // أي رحلة أخرى — بيانات جدولها المحلية قد لا تكون موجودة في هذا الجهاز — تُفتح على صفحة الدفع
  // (بيانات خادم فقط: العنوان والسعر وحالة الدفع)، تجنّبًا لعرض معاينة محلية قد تكون خاطئة.
  const isCurrent = t.id === store.getTrip().id;
  const href = isCurrent ? '#/trip' : `#/pay?trip=${encodeURIComponent(t.id)}`;
  return `
    <a class="trip-card mt-2" data-id="${t.id}" href="${href}" data-animate style="transition-delay:${Math.min(i * 50, 200)}ms">
      <img class="trip-card-img"${isCurrent ? ' data-dest-role="card"' : ''} src="${theme.cardImage}" alt="" loading="lazy" />
      <div class="trip-card-scrim"></div>
      <span class="trip-card-status${t.unlocked ? ' is-paid' : ''}">${t.unlocked ? 'مفتوحة بالكامل' : 'نسخة تجريبية'}</span>
      <div class="trip-card-actions">
        ${t.unlocked ? `<button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="download" aria-label="تحميل">${icon('external', 14)}</button>` : ''}
      </div>
      <div class="trip-card-body">
        <div class="trip-card-title">${escapeHtml(t.title)}</div>
        <div class="trip-card-meta">${icon('calendar', 13)}<span>أُنشئت ${escapeHtml(createdDate)}</span></div>
      </div>
    </a>`;
}

async function loadTripsList(listEl) {
  listEl.innerHTML = `<div class="flex items-center gap-2 text-sm text-muted" style="padding:20px 0;"><span class="spinner"></span><span>جارٍ تحميل رحلاتك المحفوظة...</span></div>`;
  try {
    const res = await fetch('/api/trips', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('failed');
    const { trips } = await res.json();

    const renderList = () => {
      const filtered = tripsTabFilter === 'المفتوحة' ? trips.filter((t) => t.unlocked) : trips;
      listEl.innerHTML = filtered.length ? filtered.map(tripCardHtml).join('') : emptyState({
        iconName: 'suitcase',
        title: tripsTabFilter === 'المفتوحة' ? 'لا توجد رحلات مفتوحة بعد' : 'لا توجد ملفات رحلة محفوظة بعد',
        desc: 'اضغط "إنشاء ملف رحلة جديد" لحفظ نسخة قابلة للتنزيل من رحلتك الحالية.',
      });
      if (window.initAnimate) initAnimate(listEl);
      if (typeof scheduleDestinationImageUpgrade === 'function') scheduleDestinationImageUpgrade(store.getTrip());
    };
    renderList();

    qsa('.trip-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tripsTabFilter);
      btn.onclick = () => { tripsTabFilter = btn.dataset.tab; qsa('.trip-tab').forEach((b) => b.classList.toggle('active', b === btn)); renderList(); };
    });

    listEl.addEventListener('click', (e) => {
      const downloadBtn = e.target.closest('[data-action="download"]');
      if (!downloadBtn) return;
      e.preventDefault();
      const card = e.target.closest('[data-id]');
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
    <div class="trip-tabs mt-3">
      <button class="trip-tab" data-tab="الكل">كل رحلاتي</button>
      <button class="trip-tab" data-tab="المفتوحة">المفتوحة</button>
    </div>
    <div id="trips-list"></div>
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
