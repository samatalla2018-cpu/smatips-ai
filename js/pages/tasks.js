// صفحة المهام

function renderTasks(container) {
  const tasks = store.list('tasks');

  const filters = `
    <div class="chip-row mt-2">
      <button class="chip active">الكل</button>
      ${TASK_CATEGORIES.map((c) => `<button class="chip">${c}</button>`).join('')}
    </div>`;

  container.innerHTML = `
    ${pageHeader({
      title: 'المهام',
      desc: 'كل ما يجب إنجازه قبل السفر وأثناءه',
      iconName: 'check',
      actions: `<button class="btn btn-primary btn-sm" id="add-task-btn">${icon('plus', 16)}<span>مهمة جديدة</span></button>`,
    })}
    ${filters}
    <div class="mt-3" id="tasks-list">
      ${tasks.length ? '' : emptyState({
        iconName: 'check',
        title: 'لا توجد مهام بعد',
        desc: 'أضف مهامك مثل: حجز الفندق، تجديد الجواز، شراء تأمين السفر — وتابع إنجازها أولًا بأول.',
      })}
    </div>
    ${comingSoonNote('إضافة المهام وتحديد أولوياتها وتواريخها سيتم تفعيلها في المرحلة القادمة.')}
  `;

  const addBtn = qs('#add-task-btn');
  if (addBtn) addBtn.addEventListener('click', () => toast('سيتم تفعيل إضافة المهام في المرحلة القادمة'));
}

registerRoute('/tasks', renderTasks);
