// صفحة الروابط المفيدة والحجوزات — CRUD كامل + فلترة حقيقية

let linksFilter = 'الكل';

function linkFormHtml(link) {
  const l = link || {};
  return `
    <form id="link-form" class="flex-col gap-3">
      <div class="field">
        <label>العنوان</label>
        <input type="text" name="title" required placeholder="مثال: حجز فندق هيلتون" value="${escapeHtml(l.title || '')}" />
      </div>
      <div class="field">
        <label>الرابط</label>
        <input type="text" name="url" required placeholder="example.com أو https://example.com" value="${escapeHtml(l.url || '')}" />
      </div>
      <div class="field">
        <label>التصنيف</label>
        <select name="category">
          ${LINK_CATEGORIES.map((c) => `<option value="${c}" ${l.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>ملاحظات (اختياري)</label>
        <textarea name="notes" placeholder="رقم الحجز، تفاصيل إضافية...">${escapeHtml(l.notes || '')}</textarea>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary btn-block">${icon('check', 16)}<span>${link ? 'حفظ التعديلات' : 'إضافة الرابط'}</span></button>
      </div>
    </form>`;
}

function normalizeUrl(url) {
  if (!/^https?:\/\//i.test(url)) return `https://${url}`;
  return url;
}

function openLinkModal(linkId) {
  const link = linkId ? store.get('links', linkId) : null;
  openModal(link ? 'تعديل الرابط' : 'إضافة رابط', linkFormHtml(link), () => {
    qs('#link-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        title: fd.get('title').trim(),
        url: normalizeUrl(fd.get('url').trim()),
        category: fd.get('category'),
        notes: fd.get('notes').trim(),
      };
      if (!data.title || !data.url) return;
      if (link) {
        store.update('links', link.id, data);
        toast('تم تحديث الرابط', 'success');
      } else {
        store.add('links', data);
        toast('تمت إضافة الرابط', 'success');
      }
      closeModal();
      renderRoute();
    });
  });
}

function linkItemHtml(l) {
  const iconName = LINK_CATEGORY_ICONS[l.category] || 'link';
  return `
    <div class="item-card" data-id="${l.id}">
      <div class="page-header-icon" style="width:34px;height:34px;border-radius:10px;">${icon(iconName, 16)}</div>
      <div style="flex:1; min-width:0;">
        <div class="item-title">${escapeHtml(l.title)}</div>
        <div class="item-meta">
          <span class="badge badge-primary">${escapeHtml(l.category || 'أخرى')}</span>
        </div>
        ${l.notes ? `<div class="text-sm text-muted mt-1">${escapeHtml(l.notes)}</div>` : ''}
      </div>
      <div class="item-actions">
        <a class="icon-btn btn-sm" style="width:32px;height:32px;" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" aria-label="فتح الرابط">${icon('external', 14)}</a>
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="edit" aria-label="تعديل">${icon('edit', 14)}</button>
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="delete" aria-label="حذف">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

function renderLinks(container) {
  const allLinks = store.list('links');
  const links = linksFilter === 'الكل' ? allLinks : allLinks.filter((l) => (l.category || 'أخرى') === linksFilter);

  const filters = `
    <div class="chip-row mt-2">
      <button class="chip ${linksFilter === 'الكل' ? 'active' : ''}" data-filter="الكل">الكل</button>
      ${LINK_CATEGORIES.map((c) => `<button class="chip ${linksFilter === c ? 'active' : ''}" data-filter="${c}">${c}</button>`).join('')}
    </div>`;

  container.innerHTML = `
    ${pageHeader({
      title: 'روابط مفيدة وحجوزات',
      desc: 'تذاكر الطيران، حجوزات الفنادق، التأشيرة والتأمين — كلها في مكان واحد',
      iconName: 'link',
      actions: `<button class="btn btn-primary btn-sm" id="add-link-btn">${icon('plus', 16)}<span>إضافة رابط</span></button>`,
    })}
    ${filters}
    <div class="mt-3" id="links-list">
      ${links.length ? links.map(linkItemHtml).join('') : emptyState(
        allLinks.length
          ? { iconName: 'link', title: 'لا توجد روابط في هذا التصنيف', desc: 'جرّب تصنيفًا آخر أو أضف رابطًا جديدًا.' }
          : { iconName: 'link', title: 'لا توجد روابط بعد', desc: 'احفظ روابط حجوزاتك وتذاكرك المهمة هنا بدلًا من البحث عنها في البريد أو واتساب.' }
      )}
    </div>
  `;

  qs('#add-link-btn').addEventListener('click', () => openLinkModal());

  qsa('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => { linksFilter = btn.dataset.filter; renderLinks(container); });
  });

  qs('#links-list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'edit') {
      openLinkModal(id);
    } else if (action === 'delete') {
      if (confirm('هل تريد حذف هذا الرابط؟')) {
        store.remove('links', id);
        toast('تم الحذف');
        renderLinks(container);
      }
    }
  });
}

registerRoute('/links', renderLinks);
