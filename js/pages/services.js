// صفحة الخدمات الموصى بها — CRUD كامل + فلترة حقيقية

let servicesFilter = 'الكل';

function serviceFormHtml(service) {
  const s = service || {};
  return `
    <form id="service-form" class="flex-col gap-3">
      <div class="field">
        <label>اسم الخدمة</label>
        <input type="text" name="title" required placeholder="مثال: شريحة اتصال محلية (eSIM)" value="${escapeHtml(s.title || '')}" />
      </div>
      <div class="field">
        <label>الرابط (اختياري)</label>
        <input type="text" name="url" placeholder="example.com أو https://example.com" value="${escapeHtml(s.url || '')}" />
      </div>
      <div class="field">
        <label>التصنيف</label>
        <select name="category">
          ${SERVICE_CATEGORIES.map((c) => `<option value="${c}" ${s.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>وصف مختصر (اختياري)</label>
        <textarea name="description" placeholder="لماذا توصي بها؟">${escapeHtml(s.description || '')}</textarea>
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary btn-block">${icon('check', 16)}<span>${service ? 'حفظ التعديلات' : 'إضافة الخدمة'}</span></button>
      </div>
    </form>`;
}

function openServiceModal(serviceId) {
  const service = serviceId ? store.get('services', serviceId) : null;
  openModal(service ? 'تعديل الخدمة' : 'إضافة خدمة', serviceFormHtml(service), () => {
    qs('#service-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const rawUrl = fd.get('url').trim();
      const data = {
        title: fd.get('title').trim(),
        url: rawUrl ? normalizeUrl(rawUrl) : '',
        category: fd.get('category'),
        description: fd.get('description').trim(),
      };
      if (!data.title) return;
      if (service) {
        store.update('services', service.id, data);
        toast('تم تحديث الخدمة', 'success');
      } else {
        store.add('services', data);
        toast('تمت إضافة الخدمة', 'success');
      }
      closeModal();
      renderRoute();
    });
  });
}

function serviceItemHtml(s) {
  return `
    <div class="item-card" data-id="${s.id}">
      <div class="page-header-icon" style="width:34px;height:34px;border-radius:10px;">${icon('star', 16)}</div>
      <div style="flex:1; min-width:0;">
        <div class="item-title">${escapeHtml(s.title)}</div>
        <div class="item-meta">
          <span class="badge badge-primary">${escapeHtml(s.category || 'أخرى')}</span>
        </div>
        ${s.description ? `<div class="text-sm text-muted mt-1">${escapeHtml(s.description)}</div>` : ''}
      </div>
      <div class="item-actions">
        ${s.url ? `<a class="icon-btn btn-sm" style="width:32px;height:32px;" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" aria-label="فتح الرابط">${icon('external', 14)}</a>` : ''}
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="edit" aria-label="تعديل">${icon('edit', 14)}</button>
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="delete" aria-label="حذف">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

function renderServices(container) {
  const allServices = store.list('services');
  const services = servicesFilter === 'الكل' ? allServices : allServices.filter((s) => (s.category || 'أخرى') === servicesFilter);

  const filters = `
    <div class="chip-row mt-2">
      <button class="chip ${servicesFilter === 'الكل' ? 'active' : ''}" data-filter="الكل">الكل</button>
      ${SERVICE_CATEGORIES.map((c) => `<button class="chip ${servicesFilter === c ? 'active' : ''}" data-filter="${c}">${c}</button>`).join('')}
    </div>`;

  container.innerHTML = `
    ${pageHeader({
      title: 'خدمات موصى بها',
      desc: 'خدمات مقترحة لتسهيل رحلتك (اتصالات، تأمين، مواصلات...)',
      iconName: 'star',
      actions: `<button class="btn btn-primary btn-sm" id="add-service-btn">${icon('plus', 16)}<span>إضافة خدمة</span></button>`,
    })}
    ${filters}
    <div class="mt-3" id="services-list">
      ${services.length ? services.map(serviceItemHtml).join('') : emptyState(
        allServices.length
          ? { iconName: 'star', title: 'لا توجد خدمات في هذا التصنيف', desc: 'جرّب تصنيفًا آخر أو أضف خدمة جديدة.' }
          : { iconName: 'star', title: 'لا توجد خدمات مضافة بعد', desc: 'أضف الخدمات التي توصي بها لنفسك أو لغيرك، مثل شركات eSIM أو التأمين أو النقل الخاص.' }
      )}
    </div>
  `;

  qs('#add-service-btn').addEventListener('click', () => openServiceModal());

  qsa('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => { servicesFilter = btn.dataset.filter; renderServices(container); });
  });

  qs('#services-list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'edit') {
      openServiceModal(id);
    } else if (action === 'delete') {
      if (confirm('هل تريد حذف هذه الخدمة؟')) {
        store.remove('services', id);
        toast('تم الحذف');
        renderServices(container);
      }
    }
  });
}

registerRoute('/services', renderServices);
