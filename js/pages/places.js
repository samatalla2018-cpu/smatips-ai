// صفحة الأماكن وخرائط Google

function renderPlaces(container) {
  const places = store.list('places');

  const typeFilters = `
    <div class="chip-row mt-2">
      <button class="chip active">كل الأنواع</button>
      ${PLACE_TYPES.map((t) => `<button class="chip">${t.label}</button>`).join('')}
    </div>`;

  container.innerHTML = `
    ${pageHeader({
      title: 'الأماكن والخرائط',
      desc: 'فنادق، مطاعم، معالم وأنشطة — بروابط خرائط Google حقيقية',
      iconName: 'map',
      actions: `<button class="btn btn-primary btn-sm" id="add-place-btn">${icon('plus', 16)}<span>إضافة مكان</span></button>`,
    })}
    ${typeFilters}
    <div class="flex items-center gap-2 mt-2">
      <button class="btn btn-outline btn-sm">${icon('filter', 15)}<span>الدولة/المدينة</span></button>
      <button class="btn btn-outline btn-sm">${icon('calendar', 15)}<span>اليوم</span></button>
      <button class="btn btn-outline btn-sm">${icon('wallet', 15)}<span>الميزانية</span></button>
    </div>

    <div class="mt-3" id="places-list">
      ${places.length ? '' : emptyState({
        iconName: 'map',
        title: 'لم تُضِف أي مكان بعد',
        desc: 'أضف الفنادق والمطاعم والمعالم التي تخطط لزيارتها، وألصق رابط Google Maps الخاص بها لفتح الموقع أو الاتجاهات بضغطة واحدة.',
      })}
    </div>

    <div class="card mt-3" style="border-style:dashed;">
      <div class="flex items-center gap-2">
        <div class="page-header-icon" style="width:34px;height:34px;border-radius:10px;">${icon('globe', 16)}</div>
        <div class="flex-col">
          <div class="font-bold text-sm">تكامل خرائط Google جاهز للتفعيل</div>
          <div class="text-sm text-muted">سيتم دعم روابط البحث، الاتجاهات، والتضمين المباشر لكل مكان — مع إمكانية إضافة Google Maps API الرسمي لاحقًا دون تغيير هيكل البيانات.</div>
        </div>
      </div>
    </div>

    ${comingSoonNote('إضافة الأماكن وربطها بالأيام والفلترة الذكية حسب الدولة والمدينة والميزانية سيتم تفعيلها في المرحلة القادمة.')}
  `;

  const addBtn = qs('#add-place-btn');
  if (addBtn) addBtn.addEventListener('click', () => toast('سيتم تفعيل إضافة الأماكن في المرحلة القادمة'));
}

registerRoute('/places', renderPlaces);
