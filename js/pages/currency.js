// صفحة تحويل العملات — تحويل حقيقي عبر ExchangeRate-API (مجاني بدون مفتاح)

async function convertCurrency(from, to, amount) {
  if (from === to) return { rate: 1, result: amount };
  const res = await fetch(`https://open.er-api.com/v6/latest/${from}`);
  if (!res.ok) throw new Error('conversion request failed');
  const data = await res.json();
  const rate = data.rates && data.rates[to];
  if (data.result !== 'success' || rate === undefined) throw new Error('currency not supported');
  return { rate, result: rate * amount };
}

function renderCurrency(container) {
  const trip = store.getTrip();

  container.innerHTML = `
    ${pageHeader({ title: 'تحويل العملات', desc: 'حوّل بين عملتك وعملة وجهتك بسرعة — أسعار صرف حقيقية ومحدّثة', iconName: 'currency' })}

    <div class="card">
      <div class="field-row">
        <div class="field">
          <label>من</label>
          <select id="from-currency">
            ${CURRENCIES.map((c) => `<option value="${c}" ${c === 'USD' ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>إلى</label>
          <select id="to-currency">
            ${CURRENCIES.map((c) => `<option value="${c}" ${c === (trip.currency || 'SAR') ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field mt-2">
        <label>المبلغ</label>
        <input type="number" id="amount-input" placeholder="100" min="0" value="100" />
      </div>
      <button class="btn btn-primary btn-block mt-2" id="convert-btn">${icon('currency', 16)}<span>تحويل</span></button>
      <div id="convert-result" class="mt-3"></div>
    </div>

    <div class="card mt-3" style="border-style:dashed;">
      <div class="flex items-center gap-2">
        <div class="page-header-icon" style="width:34px;height:34px;border-radius:10px;">${icon('info', 16)}</div>
        <div class="text-sm text-muted" style="font-weight:700;">أسعار الصرف مصدرها ExchangeRate-API، وتُحدَّث يوميًا.</div>
      </div>
    </div>
  `;

  const resultEl = qs('#convert-result');
  const btn = qs('#convert-btn');

  async function doConvert() {
    const from = qs('#from-currency').value;
    const to = qs('#to-currency').value;
    const amount = Number(qs('#amount-input').value);
    if (!amount || amount <= 0) {
      resultEl.innerHTML = `<div class="text-sm" style="color:var(--danger); font-weight:700;">أدخل مبلغًا صحيحًا أولًا</div>`;
      return;
    }
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span><span>جارٍ التحويل...</span>`;
    resultEl.innerHTML = '';
    try {
      const { rate, result } = await convertCurrency(from, to, amount);
      resultEl.innerHTML = `
        <div style="text-align:center; padding:14px; background:var(--surface-2); border-radius:var(--radius);">
          <div style="font-size:22px; font-weight:800;">${money(result)} ${to}</div>
          <div class="text-sm text-muted mt-1">1 ${from} = ${money(rate)} ${to}</div>
        </div>`;
    } catch (err) {
      console.error(err);
      resultEl.innerHTML = `<div class="text-sm" style="color:var(--danger); font-weight:700;">تعذّر الاتصال بخدمة أسعار الصرف. تأكد من اتصالك بالإنترنت وحاول مجددًا.</div>`;
    }
    btn.disabled = false;
    btn.innerHTML = `${icon('currency', 16)}<span>تحويل</span>`;
  }

  btn.addEventListener('click', doConvert);
  doConvert();
}

registerRoute('/currency', renderCurrency);
