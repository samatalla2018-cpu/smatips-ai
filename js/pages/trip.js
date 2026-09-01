// صفحة بيانات الرحلة — نموذج كامل يُحفظ تلقائيًا في المتصفح

// بطاقة حالة الرحلة: قبل وجود trip_id تعرض زر "ابدأ رحلتك" (يحجز trip_id من السيرفر)، وبعده
// تعرض حالة الدفع الفعلية لهذه الرحلة تحديدًا (لا نثق بأي حالة محفوظة محليًا — نتحقق من
// GET /api/trips في كل مرة). الدفع بقيمة 49 ريال يفتح هذه الرحلة فقط، وليس أي رحلة أخرى.
function tripStatusCardHtml(trip) {
  if (!trip.id) {
    return `
      <div class="card mt-3" id="trip-status-card">
        <div class="flex items-center gap-3">
          <div class="page-header-icon" style="width:40px;height:40px;border-radius:12px;">${icon('sparkle', 18)}</div>
          <div style="flex:1;">
            <div class="item-title">ابدأ هذه الرحلة</div>
            <div class="text-sm text-muted">أنشئ رحلة جديدة (trip_id مستقل) قبل الدفع أو استخدام "رتّب لي اليوم من جديد"</div>
          </div>
        </div>
        <button class="btn btn-primary btn-block mt-3" id="start-trip-btn">${icon('plus', 16)}<span>ابدأ رحلتي</span></button>
      </div>`;
  }
  return `<div class="card mt-3" id="trip-status-card">
    <div class="flex items-center gap-2 text-sm text-muted"><span class="spinner"></span><span>جارٍ التحقق من حالة الدفع...</span></div>
  </div>`;
}

async function refreshTripStatusCard() {
  const trip = store.getTrip();
  const card = qs('#trip-status-card');
  if (!card || !trip.id) return;

  try {
    const res = await fetch('/api/trips', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('failed');
    const { trips } = await res.json();
    const mine = trips.find((t) => t.id === trip.id);
    if (!mine) {
      card.innerHTML = `<div class="text-sm text-muted">تعذّر العثور على هذه الرحلة على حسابك.</div>`;
      return;
    }
    if (mine.unlocked) {
      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="page-header-icon" style="width:40px;height:40px;border-radius:12px;background:var(--success-light);color:var(--success);">${icon('check', 18)}</div>
          <div>
            <div class="item-title">هذه الرحلة مفتوحة ✓</div>
            <div class="text-sm text-muted">بإمكانك استخدام "رتّب لي اليوم من جديد" وتنزيل ملف الرحلة</div>
          </div>
        </div>`;
    } else {
      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="page-header-icon" style="width:40px;height:40px;border-radius:12px;">${icon('wallet', 18)}</div>
          <div style="flex:1;">
            <div class="item-title">هذه الرحلة غير مدفوعة بعد</div>
            <div class="text-sm text-muted">ادفع 49 ريال لفتح هذه الرحلة تحديدًا (تنزيل الملف + "رتّب لي اليوم من جديد")</div>
          </div>
        </div>
        <a class="btn btn-primary btn-block mt-3" href="#/pay?trip=${encodeURIComponent(trip.id)}">${icon('wallet', 16)}<span>ادفع 49 ريال</span></a>`;
    }
  } catch {
    card.innerHTML = `<div class="text-sm text-muted">تعذّر التحقق من حالة الدفع، حدّث الصفحة لاحقًا.</div>`;
  }
}

function renderTrip(container) {
  const trip = store.getTrip();

  container.innerHTML = `
    ${pageHeader({ title: 'بيانات الرحلة', desc: 'هذه البيانات تُستخدم في كل أنحاء الموقع', iconName: 'passport' })}
    ${tripStatusCardHtml(trip)}

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

  const startBtn = qs('#start-trip-btn');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true; startBtn.innerHTML = '<span>جارٍ الإنشاء...</span>';
      try {
        const res = await fetch('/api/trips', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: store.getTrip().title || 'رحلتي' }),
        });
        const data = await res.json();
        if (!res.ok || !data.trip) {
          toast(data.error || 'تعذّر إنشاء الرحلة', 'error');
          startBtn.disabled = false; startBtn.innerHTML = `${icon('plus', 16)}<span>ابدأ رحلتي</span>`;
          return;
        }
        store.updateTrip({ id: data.trip.id });
        toast('تم إنشاء رحلتك', 'success');
        renderTrip(container);
      } catch {
        toast('تعذّر الاتصال بالخادم', 'error');
        startBtn.disabled = false; startBtn.innerHTML = `${icon('plus', 16)}<span>ابدأ رحلتي</span>`;
      }
    });
  } else {
    refreshTripStatusCard();
  }
}

registerRoute('/trip', renderTrip);
