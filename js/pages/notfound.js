// صفحة غير موجودة

function renderNotFound(container) {
  container.innerHTML = `
    ${emptyState({
      iconName: 'info',
      title: 'الصفحة غير موجودة',
      desc: 'الرابط الذي حاولت الوصول إليه غير متاح.',
      actionLabel: 'العودة للرئيسية',
      actionAttrs: `onclick="navigate('/')"`,
    })}
  `;
}

registerRoute('/404', renderNotFound);
