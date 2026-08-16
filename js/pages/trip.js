// صفحة بيانات الرحلة — نموذج كامل يُحفظ تلقائيًا في المتصفح

function renderTrip(container) {
  const trip = store.getTrip();

  container.innerHTML = `
    ${pageHeader({ title: 'بيانات الرحلة', desc: 'هذه البيانات تُستخدم في كل أنحاء الموقع', iconName: 'passport' })}

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
    </form>

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
        <div class="section-card-icon" style="background:var(--accent-light); color:var(--accent);">${icon('bag', 20)}</div>
        <div>
          <div class="section-card-title">جهّز قائمة أغراضك</div>
          <div class="section-card-sub">لا تنسَ أي شيء مهم</div>
        </div>
      </a>
    </div>
  `;

  const form = qs('#trip-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
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
    toast('تم حفظ بيانات الرحلة', 'success');
  });
}

registerRoute('/trip', renderTrip);
