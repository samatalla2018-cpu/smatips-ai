// صفحة قائمة أغراض السفر — CRUD كامل + فلترة حقيقية

let packingFilter = 'الكل';

function packingFormHtml(item) {
  const it = item || {};
  return `
    <form id="packing-form" class="flex-col gap-3">
      <div class="field">
        <label>اسم الغرض</label>
        <input type="text" name="name" required placeholder="مثال: شاحن الجوال" value="${escapeHtml(it.name || '')}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>الفئة</label>
          <select name="category">
            ${PACKING_CATEGORIES.map((c) => `<option value="${c}" ${it.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>الكمية</label>
          <input type="number" name="qty" min="1" value="${it.qty || 1}" />
        </div>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary btn-block">${icon('check', 16)}<span>${item ? 'حفظ التعديلات' : 'إضافة الغرض'}</span></button>
      </div>
    </form>`;
}

function openPackingModal(itemId) {
  const item = itemId ? store.get('packing', itemId) : null;
  openModal(item ? 'تعديل الغرض' : 'إضافة غرض', packingFormHtml(item), () => {
    qs('#packing-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        name: fd.get('name').trim(),
        category: fd.get('category'),
        qty: Number(fd.get('qty')) || 1,
      };
      if (!data.name) return;
      if (item) {
        store.update('packing', item.id, data);
        toast('تم تحديث الغرض', 'success');
      } else {
        store.add('packing', { ...data, packed: false });
        toast('تمت إضافة الغرض', 'success');
      }
      closeModal();
      renderRoute();
    });
  });
}

function packingItemHtml(it) {
  return `
    <div class="item-card" data-id="${it.id}">
      <button class="item-check ${it.packed ? 'checked' : ''}" data-action="toggle" aria-label="تم التجهيز">
        ${it.packed ? icon('check', 14) : ''}
      </button>
      <div style="flex:1; min-width:0;">
        <div class="item-title ${it.packed ? 'done' : ''}">${escapeHtml(it.name)}${it.qty > 1 ? ` × ${it.qty}` : ''}</div>
        <div class="item-meta">
          <span class="badge badge-primary">${escapeHtml(it.category || 'أخرى')}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="edit" aria-label="تعديل">${icon('edit', 14)}</button>
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="delete" aria-label="حذف">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

function renderPacking(container) {
  const allItems = store.list('packing');
  const items = packingFilter === 'الكل' ? allItems : allItems.filter((it) => (it.category || 'أخرى') === packingFilter);

  const filters = `
    <div class="chip-row mt-2">
      <button class="chip ${packingFilter === 'الكل' ? 'active' : ''}" data-filter="الكل">الكل</button>
      ${PACKING_CATEGORIES.map((c) => `<button class="chip ${packingFilter === c ? 'active' : ''}" data-filter="${c}">${c}</button>`).join('')}
    </div>`;

  container.innerHTML = `
    ${pageHeader({
      title: 'قائمة أغراض السفر',
      desc: `${allItems.filter((it) => it.packed).length}/${allItems.length} غرض مجهّز`,
      iconName: 'bag',
      actions: `<button class="btn btn-primary btn-sm" id="add-item-btn">${icon('plus', 16)}<span>إضافة غرض</span></button>`,
    })}
    ${filters}
    <div class="mt-3" id="packing-list">
      ${items.length ? items.map(packingItemHtml).join('') : emptyState(
        allItems.length
          ? { iconName: 'bag', title: 'لا توجد أغراض في هذه الفئة', desc: 'جرّب فئة أخرى أو أضف غرضًا جديدًا.' }
          : { iconName: 'bag', title: 'القائمة فارغة', desc: 'أضف الأغراض التي تحتاجها حسب الفئة، وضع علامة عليها فور تجهيزها في الحقيبة.' }
      )}
    </div>
  `;

  qs('#add-item-btn').addEventListener('click', () => openPackingModal());

  qsa('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => { packingFilter = btn.dataset.filter; renderPacking(container); });
  });

  qs('#packing-list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle') {
      const it = store.get('packing', id);
      store.update('packing', id, { packed: !it.packed });
      renderPacking(container);
    } else if (action === 'edit') {
      openPackingModal(id);
    } else if (action === 'delete') {
      if (confirm('هل تريد حذف هذا الغرض؟')) {
        store.remove('packing', id);
        toast('تم الحذف');
        renderPacking(container);
      }
    }
  });
}

registerRoute('/packing', renderPacking);
