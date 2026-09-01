// صفحة "ادفع لفتح هذه الرحلة" — تعرض السعر (49 ريال) وتبدأ الدفع عبر Moyasar لـ trip_id محدد.
// الدفع هنا مرتبط بهذه الرحلة تحديدًا فقط؛ لا يفتح أي رحلة أخرى لنفس المستخدم.

function payEmptyStateHtml() {
  return emptyState({
    iconName: 'passport',
    title: 'لا توجد رحلة لدفعها بعد',
    desc: 'أنشئ رحلة من صفحة "بيانات الرحلة" أولًا.',
  }) + `<div class="mt-3"><a class="btn btn-primary" href="#/trip">${icon('passport', 16)}<span>بيانات الرحلة</span></a></div>`;
}

async function loadPayCard(container, tripId) {
  const host = qs('#pay-card');
  if (!host) return;

  let trips, priceData;
  try {
    const [tripsRes, priceRes] = await Promise.all([
      fetch('/api/trips', { credentials: 'same-origin' }),
      fetch('/api/subscription/status', { credentials: 'same-origin' }),
    ]);
    if (!tripsRes.ok) throw new Error('trips failed');
    ({ trips } = await tripsRes.json());
    priceData = priceRes.ok ? await priceRes.json() : {};
  } catch {
    host.innerHTML = `<div class="text-sm text-muted" style="text-align:center;padding:20px 0;">تعذّر تحميل بيانات الرحلة، حدّث الصفحة.</div>`;
    return;
  }

  const trip = trips.find((t) => t.id === tripId);
  if (!trip) {
    host.innerHTML = payEmptyStateHtml();
    return;
  }

  if (trip.unlocked) {
    host.innerHTML = `
      <div class="page-header-icon" style="width:52px;height:52px;border-radius:16px;margin:0 auto 12px;background:var(--success-light);color:var(--success);">${icon('check', 24)}</div>
      <h2 style="text-align:center;font-size:18px;margin-bottom:6px;">هذه الرحلة مفتوحة بالفعل ✓</h2>
      <p class="text-sm text-muted" style="text-align:center;margin-bottom:16px;">"${escapeHtml(trip.title)}" مدفوعة ويمكنك استخدام كل ميزاتها.</p>
      <div class="flex gap-2">
        <a class="btn btn-primary btn-block" href="#/itinerary">${icon('calendar', 16)}<span>جدول الرحلة</span></a>
        <a class="btn btn-outline btn-block" href="#/trips">${icon('suitcase', 16)}<span>رحلاتي</span></a>
      </div>`;
    return;
  }

  const priceSar = priceData.price_sar;
  host.innerHTML = `
    <div class="page-header-icon" style="width:52px;height:52px;border-radius:16px;margin:0 auto 12px;">${icon('wallet', 24)}</div>
    <h2 style="text-align:center;font-size:18px;margin-bottom:4px;">افتح رحلة "${escapeHtml(trip.title)}"</h2>
    <p class="text-sm text-muted" style="text-align:center;margin-bottom:14px;">دفعة واحدة تفتح هذه الرحلة فقط — لا تفتح أي رحلة أخرى</p>
    ${priceSar ? `<div style="text-align:center;font-size:30px;font-weight:800;color:var(--primary-dark);margin-bottom:16px;">${priceSar} <span style="font-size:14px;color:var(--text-muted);font-weight:700;">ريال</span></div>` : ''}
    <button class="btn btn-primary btn-block" id="pay-now-btn">${icon('wallet', 16)}<span>ادفع الآن</span></button>
    <div class="msg" id="pay-msg" style="font-size:13px;text-align:center;margin-top:10px;min-height:18px;"></div>`;

  qs('#pay-now-btn').addEventListener('click', async () => {
    const btn = qs('#pay-now-btn');
    const msg = qs('#pay-msg');
    btn.disabled = true; btn.innerHTML = '<span>جارٍ التحويل لصفحة الدفع...</span>';
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        if (msg) { msg.textContent = data.error || 'تعذّر بدء عملية الدفع'; msg.style.color = '#E11D48'; }
        btn.disabled = false; btn.innerHTML = `${icon('wallet', 16)}<span>ادفع الآن</span>`;
        return;
      }
      window.location.href = data.url;
    } catch {
      if (msg) { msg.textContent = 'تعذّر الاتصال بالخادم'; msg.style.color = '#E11D48'; }
      btn.disabled = false; btn.innerHTML = `${icon('wallet', 16)}<span>ادفع الآن</span>`;
    }
  });
}

function renderPay(container) {
  const tripId = currentQuery().get('trip') || store.getTrip().id;

  container.innerHTML = `
    ${pageHeader({ title: 'فتح الرحلة', desc: 'دفعة 49 ريال لكل رحلة على حدة', iconName: 'wallet' })}
    <div class="card mt-3" style="max-width:420px;margin:0 auto;padding:26px 22px;" id="pay-card">
      <div class="flex items-center gap-2 text-sm text-muted" style="justify-content:center;padding:16px 0;"><span class="spinner"></span><span>جارٍ التحميل...</span></div>
    </div>
  `;

  if (!tripId) {
    qs('#pay-card').innerHTML = payEmptyStateHtml();
    return;
  }
  loadPayCard(container, tripId);
}

registerRoute('/pay', renderPay);
