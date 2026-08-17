// صفحة المهام — CRUD كامل + فلترة حقيقية

const TASK_PRIORITIES = ['عادي', 'مهم', 'عاجل'];
let tasksFilter = 'الكل';

function taskFormHtml(task) {
  const t = task || {};
  return `
    <form id="task-form" class="flex-col gap-3">
      <div class="field">
        <label>عنوان المهمة</label>
        <input type="text" name="title" required placeholder="مثال: تجديد جواز السفر" value="${escapeHtml(t.title || '')}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>التصنيف</label>
          <select name="category">
            ${TASK_CATEGORIES.map((c) => `<option value="${c}" ${t.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>الأولوية</label>
          <select name="priority">
            ${TASK_PRIORITIES.map((p) => `<option value="${p}" ${t.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label>تاريخ الاستحقاق (اختياري)</label>
        <input type="date" name="dueDate" value="${escapeHtml(t.dueDate || '')}" />
      </div>
      <div class="modal-actions">
        <button type="submit" class="btn btn-primary btn-block">${icon('check', 16)}<span>${task ? 'حفظ التعديلات' : 'إضافة المهمة'}</span></button>
      </div>
    </form>`;
}

function openTaskModal(taskId) {
  const task = taskId ? store.get('tasks', taskId) : null;
  openModal(task ? 'تعديل المهمة' : 'مهمة جديدة', taskFormHtml(task), () => {
    qs('#task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        title: fd.get('title').trim(),
        category: fd.get('category'),
        priority: fd.get('priority'),
        dueDate: fd.get('dueDate'),
      };
      if (!data.title) return;
      if (task) {
        store.update('tasks', task.id, data);
        toast('تم تحديث المهمة', 'success');
      } else {
        store.add('tasks', { ...data, done: false });
        toast('تمت إضافة المهمة', 'success');
      }
      closeModal();
      renderRoute();
    });
  });
}

function priorityBadgeClass(p) {
  if (p === 'عاجل') return 'badge-danger';
  if (p === 'مهم') return 'badge-accent';
  return 'badge';
}

function taskItemHtml(t) {
  return `
    <div class="item-card" data-id="${t.id}">
      <button class="item-check ${t.done ? 'checked' : ''}" data-action="toggle" aria-label="إنجاز">
        ${t.done ? icon('check', 14) : ''}
      </button>
      <div style="flex:1; min-width:0;">
        <div class="item-title ${t.done ? 'done' : ''}">${escapeHtml(t.title)}</div>
        <div class="item-meta">
          <span class="badge badge-primary">${escapeHtml(t.category || 'أخرى')}</span>
          ${t.priority && t.priority !== 'عادي' ? `<span class="badge ${priorityBadgeClass(t.priority)}">${escapeHtml(t.priority)}</span>` : ''}
          ${t.dueDate ? `<span class="badge">${icon('calendar', 12)} ${formatDateAr(t.dueDate, { weekday: false, year: false })}</span>` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="edit" aria-label="تعديل">${icon('edit', 14)}</button>
        <button class="icon-btn btn-sm" style="width:32px;height:32px;" data-action="delete" aria-label="حذف">${icon('trash', 14)}</button>
      </div>
    </div>`;
}

function renderTasks(container) {
  const allTasks = store.list('tasks');
  const tasks = tasksFilter === 'الكل' ? allTasks : allTasks.filter((t) => (t.category || 'أخرى') === tasksFilter);

  const filters = `
    <div class="chip-row mt-2">
      <button class="chip ${tasksFilter === 'الكل' ? 'active' : ''}" data-filter="الكل">الكل</button>
      ${TASK_CATEGORIES.map((c) => `<button class="chip ${tasksFilter === c ? 'active' : ''}" data-filter="${c}">${c}</button>`).join('')}
    </div>`;

  container.innerHTML = `
    ${pageHeader({
      title: 'المهام',
      desc: `${allTasks.filter((t) => t.done).length}/${allTasks.length} مهمة منجزة`,
      iconName: 'check',
      actions: `<button class="btn btn-primary btn-sm" id="add-task-btn">${icon('plus', 16)}<span>مهمة جديدة</span></button>`,
    })}
    ${filters}
    <div class="mt-3" id="tasks-list">
      ${tasks.length ? tasks.map(taskItemHtml).join('') : emptyState(
        allTasks.length
          ? { iconName: 'check', title: 'لا توجد مهام في هذا التصنيف', desc: 'جرّب تصنيفًا آخر أو أضف مهمة جديدة.' }
          : { iconName: 'check', title: 'لا توجد مهام بعد', desc: 'أضف مهامك مثل: حجز الفندق، تجديد الجواز، شراء تأمين السفر — وتابع إنجازها أولًا بأول.' }
      )}
    </div>
  `;

  qs('#add-task-btn').addEventListener('click', () => openTaskModal());

  qsa('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => { tasksFilter = btn.dataset.filter; renderTasks(container); });
  });

  qs('#tasks-list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle') {
      const t = store.get('tasks', id);
      store.update('tasks', id, { done: !t.done });
      renderTasks(container);
    } else if (action === 'edit') {
      openTaskModal(id);
    } else if (action === 'delete') {
      if (confirm('هل تريد حذف هذه المهمة؟')) {
        store.remove('tasks', id);
        toast('تم حذف المهمة');
        renderTasks(container);
      }
    }
  });
}

registerRoute('/tasks', renderTasks);
