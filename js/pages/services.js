// صفحة الخدمات الموصى بها

function renderServices(container) {
  const services = store.list('services');

  const filters = `
    <div class="chip-row mt-2">
      <button class="chip active">الكل</button>
      ${SERVICE_CATEGORIES.map((c) => `<button class="chip">${c}</button>`).join('')}
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
      ${services.length ? '' : emptyState({
        iconName: 'star',
        title: 'لا توجد خدمات مضافة بعد',
        desc: 'أضف الخدمات التي توصي بها لنفسك أو لغيرك، مثل شركات eSIM أو التأمين أو النقل الخاص.',
      })}
    </div>
    ${comingSoonNote('إضافة الخدمات الموصى بها وروابطها سيتم تفعيلها في المرحلة القادمة.')}
  `;

  const addBtn = qs('#add-service-btn');
  if (addBtn) addBtn.addEventListener('click', () => toast('سيتم تفعيل إضافة الخدمات في المرحلة القادمة'));
}

registerRoute('/services', renderServices);
