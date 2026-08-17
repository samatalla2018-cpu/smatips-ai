// صفحة الأماكن وخرائط Google — CRUD كامل + روابط خرائط حقيقية + فلترة

const PLACE_BUDGETS = ['اقتصادي $', 'متوسط $$', 'مرتفع $$$'];

let placesTypeFilter = 'الكل';
let placesCityFilter = 'الكل';
let placesBudgetFilter = 'الكل';
let placesSearchQuery = '';
let placesNearbyActive = false;
let placesDistances = {};

function placeFormHtml(place) {
  const p = place || {};
  const trip = store.getTrip();
  return `
    <form id="place-form" class="flex-col gap-3">
      <div class="field">
        <label>اسم المكان</label>
        <input type="text" name="name" required placeholder="مثال: فندق الفيصلية" value="${escapeHtml(p.name || '')}" />
      </div>
      <div class="field">
        <label>النوع</label>
        <select name="type">
          ${PLACE_TYPES.map((t) => `<option value="${t.id}" ${p.type === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field">
          <label>المدينة</label>
          <input type="text" name="city" placeholder="مثال: إسطنبول" value="${escapeHtml(p.city || trip.city || '')}" />
        </div>
        <div class="field">
          <label>الدولة</label>
          <input type="text" name="country" placeholder="مثال: تركيا" value="${escapeHtml(p.country || trip.country || '')}" />
        </div>
      </div>
      <div class="field">
        <label>رابط Google Maps (اختياري)</label>
        <input type="text" name="mapsUrl" placeholder="الصق رابط الموقع من خرائط جوجل" value="${escapeHtml(p.mapsUrl || '')}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>الميزانية</label>
          <select name="budget">
            <option value="">بدون تحديد</option>
            ${PLACE_BUDGETS.map((b) => `<option value="${b}" ${p.budget === b ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>التقييم (اختياري)</label>
          <select name="rating">
            <option value="">بدون تقييم</option>
            ${[5, 4, 3, 2, 1].map((r) => `<option value="${r}" ${String(p.rating) === String(r) ? 'selected' : ''}>${'★'.repeat(r)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label>ملاحظات (اختياري)</label>
        <textarea name="notes" placeholder="أي تفاصيل تريد تذكّرها...">${escapeHtml(p.notes || '')}</textarea>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary btn-block">${icon('check', 16)}<span>${place ? 'حفظ التعديلات' : 'إضافة المكان'}</span></button>
      </div>
    </form>`;
}

function openPlaceModal(placeId) {
  const place = placeId ? store.get('places', placeId) : null;
  openModal(place ? 'تعديل المكان' : 'إضافة مكان', placeFormHtml(place), () => {
    qs('#place-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const mapsUrlRaw = fd.get('mapsUrl').trim();
      if (mapsUrlRaw && !isValidMapsUrl(mapsUrlRaw)) {
        toast('الرابط المُدخل ليس رابط Google Maps صالحًا', 'error');
        return;
      }
      const data = {
        name: fd.get('name').trim(),
        type: fd.get('type'),
        city: fd.get('city').trim(),
        country: fd.get('country').trim(),
        mapsUrl: mapsUrlRaw,
        budget: fd.get('budget'),
        rating: fd.get('rating'),
        notes: fd.get('notes').trim(),
      };
      if (!data.name) return;
      if (place) {
        store.update('places', place.id, data);
        toast('تم تحديث المكان', 'success');
      } else {
        store.add('places', data);
        toast('تمت إضافة المكان', 'success');
      }
      closeModal();
      renderRoute();
    });
  });
}

function placeTypeMeta(typeId) {
  return PLACE_TYPES.find((t) => t.id === typeId) || PLACE_TYPES[PLACE_TYPES.length - 1];
}

function placeQuery(p) {
  return [p.name, p.city, p.country].filter(Boolean).join(' ');
}

function placeItemHtml(p) {
  const typeMeta = placeTypeMeta(p.type);
  const openUrl = p.mapsUrl || mapsSearchUrl(placeQuery(p));
  const dirUrl = mapsDirectionsUrl(placeQuery(p));
  const dist = placesDistances[p.id];
  return `
    <div class="item-card" data-id="${p.id}">
      <div class="page-header-icon" style="width:38px;height:38px;border-radius:11px;">${icon(typeMeta.icon, 18)}</div>
      <div style="flex:1; min-width:0;">
        <div class="item-title">${escapeHtml(p.name)}</div>
        <div class="item-meta">
          <span class="badge badge-primary">${escapeHtml(typeMeta.label)}</span>
          ${p.city ? `<span class="badge">${escapeHtml(p.city)}</span>` : ''}
          ${p.budget ? `<span class="badge badge-accent">${escapeHtml(p.budget)}</span>` : ''}
          ${p.rating ? `<span class="badge">${'★'.repeat(Number(p.rating))}</span>` : ''}
          ${dist !== undefined ? `<span class="badge badge-success">${dist === null ? 'المسافة غير معروفة' : `${dist.toFixed(1)} كم`}</span>` : ''}
        </div>
        ${p.notes ? `<div class="text-sm text-muted mt-1">${escapeHtml(p.notes)}</div>` : ''}
        <div class="flex gap-2 mt-2" style="flex-wrap:wrap;">
          <a class="btn btn-outline btn-sm" href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer">${icon('map', 14)}<span>فتح على الخريطة</span></a>
          <a class="btn btn-outline btn-sm" href="${escapeHtml(dirUrl)}" target="_blank" rel="noopener noreferrer">${icon('navigation', 14)}<span>الاتجاهات</span></a>
          <button class="btn btn-outline btn-sm" data-action="toggle-embed">${icon('globe', 14)}<span>عرض الخريطة هنا</span></button>
        </div>
        <div class="map-embed-wrap" hidden></div>
      </div>
      <div class="item-actions">
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="edit" aria-label="تعديل">${icon('edit', 14)}</button>
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="delete" aria-label="حذف">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

function getPlaceCities(places) {
  const cities = new Set(places.map((p) => p.city).filter(Boolean));
  return Array.from(cities);
}

function filteredPlaces() {
  let list = store.list('places');
  if (placesTypeFilter !== 'الكل') list = list.filter((p) => p.type === placesTypeFilter);
  if (placesCityFilter !== 'الكل') list = list.filter((p) => p.city === placesCityFilter);
  if (placesBudgetFilter !== 'الكل') list = list.filter((p) => p.budget === placesBudgetFilter);
  if (placesSearchQuery.trim()) {
    const q = placesSearchQuery.trim().toLowerCase();
    list = list.filter((p) => [p.name, p.city, p.country, p.notes].filter(Boolean).some((v) => v.toLowerCase().includes(q)));
  }
  if (placesNearbyActive) {
    list = list.slice().sort((a, b) => {
      const da = placesDistances[a.id] ?? Infinity;
      const db = placesDistances[b.id] ?? Infinity;
      return da - db;
    });
  }
  return list;
}

async function activateNearby(container) {
  const btn = qs('#nearby-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span><span>جارٍ تحديد موقعك...</span>`;
  try {
    const here = await getCurrentPosition();
    const allPlaces = store.list('places');
    const uniqueCities = getPlaceCities(allPlaces);
    const coordsByCity = {};
    for (const city of uniqueCities) {
      coordsByCity[city] = await geocodeCity(city);
    }
    placesDistances = {};
    for (const p of allPlaces) {
      const c = p.city ? coordsByCity[p.city] : null;
      placesDistances[p.id] = c ? haversineKm(here.lat, here.lon, c.lat, c.lon) : null;
    }
    placesNearbyActive = true;
    toast('تم ترتيب الأماكن حسب الأقرب إليك', 'success');
  } catch (err) {
    console.error(err);
    toast('تعذّر الوصول إلى موقعك — تأكد من السماح بإذن الموقع للمتصفح', 'error');
  }
  renderPlaces(container);
}

function placesListInnerHtml() {
  const allPlaces = store.list('places');
  const places = filteredPlaces();
  if (places.length) return places.map(placeItemHtml).join('');
  if (allPlaces.length) return emptyState({ iconName: 'map', title: 'لا توجد أماكن مطابقة', desc: 'جرّب تغيير البحث أو الفلاتر.' });
  return emptyState({ iconName: 'map', title: 'لم تُضِف أي مكان بعد', desc: 'أضف الفنادق والمطاعم والمعالم التي تخطط لزيارتها، وألصق رابط Google Maps الخاص بها لفتح الموقع أو الاتجاهات بضغطة واحدة.' });
}

function renderPlacesList() {
  qs('#places-list').innerHTML = placesListInnerHtml();
}

function renderPlaces(container) {
  const allPlaces = store.list('places');
  const cities = getPlaceCities(allPlaces);

  const typeFilters = `
    <div class="chip-row mt-2">
      <button class="chip ${placesTypeFilter === 'الكل' ? 'active' : ''}" data-type-filter="الكل">كل الأنواع</button>
      ${PLACE_TYPES.map((t) => `<button class="chip ${placesTypeFilter === t.id ? 'active' : ''}" data-type-filter="${t.id}">${t.label}</button>`).join('')}
    </div>`;

  container.innerHTML = `
    ${pageHeader({
      title: 'الأماكن والخرائط',
      desc: 'فنادق، مطاعم، معالم وأنشطة — بروابط خرائط Google حقيقية',
      iconName: 'map',
      actions: `<button class="btn btn-primary btn-sm" id="add-place-btn">${icon('plus', 16)}<span>إضافة مكان</span></button>`,
    })}
    <div class="search-bar-btn mt-2" style="cursor:text; max-width:100%;">
      ${icon('search', 17)}
      <input id="places-search-input" type="text" placeholder="ابحث في أماكنك (اسم، مدينة، ملاحظة...)" value="${escapeHtml(placesSearchQuery)}" autocomplete="off" style="border:none; outline:none; background:transparent; flex:1; font-size:14px; font-family:inherit; color:var(--text);" />
    </div>
    ${typeFilters}
    <div class="flex items-center gap-2 mt-2" style="flex-wrap:wrap;">
      <select id="city-filter" class="chip" style="padding-inline-end:8px;">
        <option value="الكل">كل المدن</option>
        ${cities.map((c) => `<option value="${c}" ${placesCityFilter === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
      </select>
      <select id="budget-filter" class="chip" style="padding-inline-end:8px;">
        <option value="الكل">كل الميزانيات</option>
        ${PLACE_BUDGETS.map((b) => `<option value="${b}" ${placesBudgetFilter === b ? 'selected' : ''}>${b}</option>`).join('')}
      </select>
      <button class="chip ${placesNearbyActive ? 'active' : ''}" id="nearby-btn">${icon('navigation', 13)}<span> بالقرب مني</span></button>
    </div>

    <div class="mt-3" id="places-list">${placesListInnerHtml()}</div>
  `;

  qs('#add-place-btn').addEventListener('click', () => openPlaceModal());

  qsa('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => { placesTypeFilter = btn.dataset.typeFilter; renderPlaces(container); });
  });
  qs('#city-filter').addEventListener('change', (e) => { placesCityFilter = e.target.value; renderPlaces(container); });
  qs('#budget-filter').addEventListener('change', (e) => { placesBudgetFilter = e.target.value; renderPlaces(container); });
  qs('#places-search-input').addEventListener('input', debounce((e) => {
    placesSearchQuery = e.target.value;
    renderPlacesList();
  }, 150));
  qs('#nearby-btn').addEventListener('click', () => {
    if (placesNearbyActive) {
      placesNearbyActive = false;
      renderPlaces(container);
    } else {
      activateNearby(container);
    }
  });

  qs('#places-list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle-embed') {
      const wrap = card.querySelector('.map-embed-wrap');
      const btn = e.target.closest('[data-action]');
      const willShow = wrap.hidden;
      wrap.hidden = !willShow;
      if (willShow && !wrap.dataset.loaded) {
        const p = store.get('places', id);
        wrap.innerHTML = `<iframe src="${escapeHtml(mapsEmbedUrl(placeQuery(p)))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
        wrap.dataset.loaded = '1';
      }
      btn.querySelector('span').textContent = willShow ? 'إخفاء الخريطة' : 'عرض الخريطة هنا';
    } else if (action === 'edit') {
      openPlaceModal(id);
    } else if (action === 'delete') {
      if (confirm('هل تريد حذف هذا المكان؟')) {
        store.remove('places', id);
        delete placesDistances[id];
        toast('تم الحذف');
        renderPlaces(container);
      }
    }
  });
}

registerRoute('/places', renderPlaces);
