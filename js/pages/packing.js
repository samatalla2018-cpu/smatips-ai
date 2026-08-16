// صفحة قائمة أغراض السفر

function renderPacking(container) {
  const items = store.list('packing');

  const filters = `
    <div class="chip-row mt-2">
      <button class="chip active">الكل</button>
      ${PACKING_CATEGORIES.map((c) => `<button class="chip">${c}</button>`).join('')}
    </div>`;

  container.innerHTML = `
    ${pageHeader({
      title: 'قائمة أغراض السفر',
      desc: 'تأكد أنك لم تنسَ شيئًا قبل المغادرة',
      iconName: 'bag',
      actions: `<button class="btn btn-primary btn-sm" id="add-item-btn">${icon('plus', 16)}<span>إضافة غرض</span></button>`,
    })}
    ${filters}
    <div class="mt-3" id="packing-list">
      ${items.length ? '' : emptyState({
        iconName: 'bag',
        title: 'القائمة فارغة',
        desc: 'أضف الأغراض التي تحتاجها حسب الفئة، وضع علامة عليها فور تجهيزها في الحقيبة.',
      })}
    </div>
    ${comingSoonNote('إضافة الأغراض وتحديد كمياتها وتتبعها سيتم تفعيلها في المرحلة القادمة.')}
  `;

  const addBtn = qs('#add-item-btn');
  if (addBtn) addBtn.addEventListener('click', () => toast('سيتم تفعيل إضافة الأغراض في المرحلة القادمة'));
}

registerRoute('/packing', renderPacking);
