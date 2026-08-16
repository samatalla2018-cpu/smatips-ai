// صفحة تحويل العملات

function renderCurrency(container) {
  const trip = store.getTrip();

  container.innerHTML = `
    ${pageHeader({ title: 'تحويل العملات', desc: 'حوّل بين عملتك وعملة وجهتك بسرعة', iconName: 'currency' })}

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
        <input type="number" id="amount-input" placeholder="100" min="0" />
      </div>
      <button class="btn btn-primary btn-block mt-2" id="convert-btn" disabled>${icon('currency', 16)}<span>تحويل (قريبًا)</span></button>
    </div>

    ${comingSoonNote('سيتم ربط الصفحة بأسعار صرف حقيقية ومحدّثة (Frankfurter API) للتحويل الفوري بين العملات في المرحلة القادمة.')}
  `;
}

registerRoute('/currency', renderCurrency);
