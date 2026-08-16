// صفحة الروابط المفيدة والحجوزات

function renderLinks(container) {
  const links = store.list('links');

  const filters = `
    <div class="chip-row mt-2">
      <button class="chip active">الكل</button>
      ${LINK_CATEGORIES.map((c) => `<button class="chip">${c}</button>`).join('')}
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
      ${links.length ? '' : emptyState({
        iconName: 'link',
        title: 'لا توجد روابط بعد',
        desc: 'احفظ روابط حجوزاتك وتذاكرك المهمة هنا بدلًا من البحث عنها في البريد أو واتساب.',
      })}
    </div>
    ${comingSoonNote('إضافة الروابط وتصنيفها والوصول السريع لها سيتم تفعيلها في المرحلة القادمة.')}
  `;

  const addBtn = qs('#add-link-btn');
  if (addBtn) addBtn.addEventListener('click', () => toast('سيتم تفعيل إضافة الروابط في المرحلة القادمة'));
}

registerRoute('/links', renderLinks);
