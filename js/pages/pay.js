// صفحة "افتح رحلتك الذكية كاملة" — تعرض السعر لـ trip_id محدد وتتيح طريقتَي دفع: Moyasar (فوري)
// أو تحويل بنكي يدوي (يحتاج مراجعة واعتماد إداري قبل فتح الرحلة). كلا الطريقتين مرتبطتان بهذه
// الرحلة تحديدًا فقط — لا تفتحان أي رحلة أخرى لنفس المستخدم.

function payEmptyStateHtml() {
  return emptyState({
    iconName: 'passport',
    title: 'لا توجد رحلة لدفعها بعد',
    desc: 'أنشئ رحلة من صفحة "بيانات الرحلة" أولًا.',
  }) + `<div class="mt-3"><a class="btn btn-primary" href="#/trip">${icon('passport', 16)}<span>بيانات الرحلة</span></a></div>`;
}

function priceBlockHtml() {
  const price = window.PRICING.price_sar;
  const regularPrice = window.PRICING.regular_price_sar;
  const hasOffer = regularPrice && regularPrice > price;
  return `
    ${hasOffer ? `<div class="text-sm text-muted" style="text-align:center;text-decoration:line-through;">${regularPrice} ر.س</div>` : ''}
    <div style="text-align:center;font-size:30px;font-weight:800;color:var(--primary-dark);margin:2px 0 6px;">${price} <span style="font-size:14px;color:var(--text-muted);font-weight:700;">ريال</span></div>
    ${hasOffer ? `<div style="text-align:center;" class="mb-2"><span class="badge badge-accent">عرض الافتتاح لفترة محدودة</span></div>` : ''}
    <p class="text-sm text-muted" style="text-align:center;margin-bottom:14px;">دفعة واحدة لرحلة واحدة — لا تفتح أي رحلة أخرى</p>`;
}

function bankTransferStatusBadge(status) {
  const map = {
    pending: { label: 'بانتظار التحويل', cls: 'badge-info' },
    under_review: { label: 'بانتظار المراجعة', cls: 'badge-accent' },
    rejected: { label: 'مرفوض — يحتاج إعادة رفع الإيصال', cls: 'badge-danger' },
    paid: { label: 'مدفوع / معتمد', cls: 'badge-success' },
  };
  const m = map[status] || map.pending;
  return `<span class="badge ${m.cls}">${m.label}</span>`;
}

// ---------- حالة "تم استلام طلبك" — بعد إرسال إثبات التحويل، بانتظار اعتماد إداري ----------
function renderBankTransferUnderReview(host, tripId, trip, btStatus) {
  host.innerHTML = `
    <div class="page-header-icon" style="width:52px;height:52px;border-radius:16px;margin:0 auto 12px;background:var(--info-light);color:var(--sky-dark);">${icon('check', 24)}</div>
    <h2 style="text-align:center;font-size:18px;margin-bottom:4px;">تم استلام طلبك</h2>
    <p class="text-sm text-muted" style="text-align:center;margin-bottom:16px;">جارٍ التحقق من التحويل البنكي. سنفتح رحلتك فور اعتماد الدفعة.</p>
    <div class="card" style="background:var(--surface-2);border:none;padding:14px 16px;">
      <div class="flex items-center justify-between text-sm" style="padding:5px 0;"><span class="text-muted">رقم الطلب</span><strong>${escapeHtml(btStatus.order_number)}</strong></div>
      <div class="flex items-center justify-between text-sm" style="padding:5px 0;"><span class="text-muted">الوجهة</span><strong>${escapeHtml(trip.title)}</strong></div>
      <div class="flex items-center justify-between text-sm" style="padding:5px 0;"><span class="text-muted">المبلغ</span><strong>${btStatus.amount_due_sar} ر.س</strong></div>
      <div class="flex items-center justify-between text-sm" style="padding:5px 0;"><span class="text-muted">طريقة الدفع</span><strong>تحويل بنكي</strong></div>
      <div class="flex items-center justify-between text-sm" style="padding:5px 0;"><span class="text-muted">الحالة</span>${bankTransferStatusBadge(btStatus.status)}</div>
    </div>
    <button class="btn btn-outline btn-block mt-3" id="bt-refresh-btn">${icon('check', 16)}<span>تحقّق من الحالة الآن</span></button>`;
  qs('#bt-refresh-btn').addEventListener('click', () => loadPayCard(null, tripId));
}

// ---------- بيانات التحويل + نموذج إثبات التحويل ----------
function renderBankTransferForm(host, tripId, trip, btRequest) {
  host.innerHTML = `
    <h2 style="text-align:center;font-size:17px;margin-bottom:4px;">بيانات التحويل البنكي</h2>
    <p class="text-sm text-muted" style="text-align:center;margin-bottom:16px;">حوّلي مبلغ <strong>${btRequest.amount_due_sar} ر.س</strong> إلى الحساب التالي، ثم أرسلي إثبات التحويل للمراجعة.</p>

    <div class="card" style="background:var(--surface-2);border:none;padding:14px 16px;margin-bottom:16px;">
      <div class="flex items-center justify-between text-sm" style="padding:6px 0;"><span class="text-muted">المبلغ المطلوب</span><strong>${btRequest.amount_due_sar} ر.س</strong></div>
      <div class="flex items-center justify-between text-sm" style="padding:6px 0;"><span class="text-muted">البنك</span><strong>${escapeHtml(btRequest.bank_name)}</strong></div>
      <div class="flex items-center justify-between text-sm" style="padding:6px 0;"><span class="text-muted">اسم المستفيد</span><strong>${escapeHtml(btRequest.account_name)}</strong></div>
      <div class="flex items-center justify-between text-sm" style="padding:6px 0;gap:8px;">
        <span class="text-muted">IBAN</span>
        <strong style="font-family:monospace;letter-spacing:.5px;">${escapeHtml(btRequest.iban)}</strong>
      </div>
      <div class="flex items-center justify-between text-sm" style="padding:6px 0;"><span class="text-muted">رقم الطلب</span><strong>${escapeHtml(btRequest.order_number)}</strong></div>
      <div class="flex gap-2 mt-2">
        <button type="button" class="btn btn-outline btn-sm btn-block" id="bt-copy-iban-btn">نسخ الآيبان</button>
        <button type="button" class="btn btn-outline btn-sm btn-block" id="bt-copy-amount-btn">نسخ المبلغ</button>
      </div>
    </div>

    <form id="bt-proof-form">
      <div class="field mb-2">
        <label>اسم المحوّل *</label>
        <input type="text" id="bt-sender-name" placeholder="كما يظهر في الحساب البنكي" required maxlength="120" />
      </div>
      <div class="field mb-2">
        <label>رقم العملية أو المرجع</label>
        <input type="text" id="bt-reference" placeholder="اختياري" maxlength="120" />
      </div>
      <div class="field mb-2">
        <label>إيصال التحويل</label>
        <input type="file" id="bt-receipt" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" />
        <div class="field-msg" style="color:var(--text-faint);">JPG أو PNG أو WEBP أو PDF، بحد أقصى 5MB</div>
      </div>
      <div class="field mb-2">
        <label>ملاحظة إضافية</label>
        <textarea id="bt-note" placeholder="اختياري" maxlength="500"></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-block" id="bt-submit-btn">${icon('check', 16)}<span>إرسال للمراجعة</span></button>
      <div class="msg" id="bt-msg" style="font-size:13px;text-align:center;margin-top:10px;min-height:18px;"></div>
    </form>`;

  qs('#bt-copy-iban-btn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(btRequest.iban); toast('تم نسخ الآيبان ✓', 'success'); }
    catch { toast('تعذّر النسخ', 'error'); }
  });
  qs('#bt-copy-amount-btn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(String(btRequest.amount_due_sar)); toast('تم نسخ المبلغ ✓', 'success'); }
    catch { toast('تعذّر النسخ', 'error'); }
  });

  qs('#bt-proof-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const senderName = qs('#bt-sender-name').value.trim();
    if (!senderName) { toast('اسم المحوّل مطلوب', 'error'); return; }
    const btn = qs('#bt-submit-btn');
    const msg = qs('#bt-msg');
    btn.disabled = true; btn.innerHTML = `<span class="spinner"></span><span>جارٍ الإرسال...</span>`;
    msg.textContent = '';

    const fd = new FormData();
    fd.set('trip_id', tripId);
    fd.set('sender_name', senderName);
    fd.set('reference_number', qs('#bt-reference').value.trim());
    fd.set('note', qs('#bt-note').value.trim());
    const file = qs('#bt-receipt').files[0];
    if (file) fd.set('receipt', file);

    try {
      const res = await fetch('/api/payment/bank-transfer/submit-proof', { method: 'POST', credentials: 'same-origin', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        msg.textContent = data.error || 'تعذّر إرسال الطلب'; msg.style.color = 'var(--danger)';
        btn.disabled = false; btn.innerHTML = `${icon('check', 16)}<span>إرسال للمراجعة</span>`;
        return;
      }
      toast('تم استلام طلبك، بانتظار المراجعة', 'success');
      renderBankTransferUnderReview(host, tripId, trip, { order_number: data.order_number, status: data.status, amount_due_sar: btRequest.amount_due_sar });
    } catch {
      msg.textContent = 'تعذّر الاتصال بالخادم'; msg.style.color = 'var(--danger)';
      btn.disabled = false; btn.innerHTML = `${icon('check', 16)}<span>إرسال للمراجعة</span>`;
    }
  });
}

// ---------- اختيار طريقة الدفع (Moyasar أو تحويل بنكي) ----------
function renderPaymentOptions(host, trip, tripId, priorBtStatus) {
  host.innerHTML = `
    <div class="page-header-icon" style="width:52px;height:52px;border-radius:16px;margin:0 auto 12px;">${icon('wallet', 24)}</div>
    <h2 style="text-align:center;font-size:18px;margin-bottom:4px;">افتح رحلة "${escapeHtml(trip.title)}"</h2>
    ${priceBlockHtml()}
    ${priorBtStatus && priorBtStatus.status === 'rejected' ? `
      <div class="field-msg error" style="text-align:center;margin-bottom:12px;">تعذّر اعتماد تحويلك السابق (${escapeHtml(priorBtStatus.order_number)}) — يمكنك إعادة المحاولة أدناه.</div>
    ` : ''}
    <button class="btn btn-primary btn-block" id="pay-now-btn">${icon('wallet', 16)}<span>ادفع الآن — بطاقة/Apple Pay</span></button>
    <button class="btn btn-outline btn-block mt-2" id="pay-bank-transfer-btn">${icon('passport', 16)}<span>التحويل البنكي</span></button>
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
        if (msg) { msg.textContent = data.error || 'تعذّر بدء عملية الدفع'; msg.style.color = 'var(--danger)'; }
        btn.disabled = false; btn.innerHTML = `${icon('wallet', 16)}<span>ادفع الآن — بطاقة/Apple Pay</span>`;
        return;
      }
      window.location.href = data.url;
    } catch {
      if (msg) { msg.textContent = 'تعذّر الاتصال بالخادم'; msg.style.color = 'var(--danger)'; }
      btn.disabled = false; btn.innerHTML = `${icon('wallet', 16)}<span>ادفع الآن — بطاقة/Apple Pay</span>`;
    }
  });

  qs('#pay-bank-transfer-btn').addEventListener('click', async () => {
    const btn = qs('#pay-bank-transfer-btn');
    const msg = qs('#pay-msg');
    btn.disabled = true; btn.innerHTML = `<span class="spinner"></span><span>جارٍ التحضير...</span>`;
    try {
      const res = await fetch('/api/payment/bank-transfer/create', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (msg) { msg.textContent = data.error || 'تعذّر إنشاء طلب التحويل البنكي'; msg.style.color = 'var(--danger)'; }
        btn.disabled = false; btn.innerHTML = `${icon('passport', 16)}<span>التحويل البنكي</span>`;
        return;
      }
      renderBankTransferForm(host, tripId, trip, data.request);
    } catch {
      if (msg) { msg.textContent = 'تعذّر الاتصال بالخادم'; msg.style.color = 'var(--danger)'; }
      btn.disabled = false; btn.innerHTML = `${icon('passport', 16)}<span>التحويل البنكي</span>`;
    }
  });
}

async function loadPayCard(container, tripId) {
  const host = qs('#pay-card');
  if (!host) return;

  let trips, btStatus;
  try {
    const [tripsRes, btRes] = await Promise.all([
      fetch('/api/trips', { credentials: 'same-origin' }),
      fetch(`/api/payment/bank-transfer/status?trip_id=${encodeURIComponent(tripId)}`, { credentials: 'same-origin' }),
    ]);
    if (!tripsRes.ok) throw new Error('trips failed');
    ({ trips } = await tripsRes.json());
    btStatus = btRes.ok ? (await btRes.json()).request : null;
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

  // طلب تحويل بنكي "نشط" أو تم إنشاؤه بلا إثبات بعد — نكمل من حيث توقّف المستخدم بدل عرض خيارات
  // الدفع من جديد (يمنع أيضًا إنشاء طلب تحويل مكرر لنفس trip_id).
  if (btStatus && btStatus.status === 'under_review') {
    renderBankTransferUnderReview(host, tripId, trip, btStatus);
    return;
  }
  if (btStatus && btStatus.status === 'pending') {
    try {
      const res = await fetch('/api/payment/bank-transfer/create', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { renderBankTransferForm(host, tripId, trip, data.request); return; }
    } catch { /* نسقط إلى خيارات الدفع أدناه */ }
  }

  renderPaymentOptions(host, trip, tripId, btStatus);
}

function renderPay(container) {
  const tripId = currentQuery().get('trip') || store.getTrip().id;

  container.innerHTML = `
    ${pageHeader({ title: 'افتح رحلتك الذكية كاملة', desc: 'دفعة واحدة لكل رحلة على حدة', iconName: 'wallet' })}
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
