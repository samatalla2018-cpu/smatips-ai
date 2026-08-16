// صفحة جدول الرحلة اليومي

function renderItinerary(container) {
  const trip = store.getTrip();
  const days = store.list('days');

  const filters = `
    <div class="chip-row mt-2">
      <button class="chip active">كل الأيام</button>
      <button class="chip">اليوم الحالي</button>
      <button class="chip">صباح</button>
      <button class="chip">ظهر</button>
      <button class="chip">مساء</button>
    </div>`;

  container.innerHTML = `
    ${pageHeader({
      title: 'جدول الرحلة اليومي',
      desc: trip.startDate ? `من ${formatDateAr(trip.startDate)} إلى ${formatDateAr(trip.endDate) || '—'}` : 'خطط لكل يوم من رحلتك بالتفصيل',
      iconName: 'calendar',
      actions: `<button class="btn btn-primary btn-sm" id="add-day-btn">${icon('plus', 16)}<span>إضافة يوم</span></button>`,
    })}
    ${filters}
    <div class="mt-3" id="days-list">
      ${days.length ? '' : emptyState({
        iconName: 'calendar',
        title: 'لا يوجد جدول بعد',
        desc: 'أضف بيانات الرحلة أولًا لتحديد التواريخ، ثم ابدأ ببناء جدول يومي مفصّل لكل نشاط وموعد.',
      })}
    </div>
    ${comingSoonNote('إضافة الأيام والأنشطة وربطها بالأماكن على الخريطة سيتم تفعيلها في المرحلة القادمة.')}
  `;

  const addBtn = qs('#add-day-btn');
  if (addBtn) addBtn.addEventListener('click', () => toast('سيتم تفعيل إضافة الأيام في المرحلة القادمة'));
}

registerRoute('/itinerary', renderItinerary);
