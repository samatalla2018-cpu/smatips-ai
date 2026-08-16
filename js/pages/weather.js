// صفحة الطقس

function renderWeather(container) {
  const trip = store.getTrip();
  const dest = [trip.city, trip.country].filter(Boolean).join('، ');

  container.innerHTML = `
    ${pageHeader({ title: 'الطقس', desc: dest ? `حالة الطقس المتوقعة في ${dest}` : 'أضف وجهتك لعرض الطقس المتوقع', iconName: 'cloud' })}

    ${dest ? `
      <div class="card flex items-center gap-3">
        <div class="page-header-icon" style="width:52px;height:52px;border-radius:14px;">${icon('cloud', 26)}</div>
        <div>
          <div class="font-bold">${escapeHtml(dest)}</div>
          <div class="text-sm text-muted">سيتم عرض درجات الحرارة والتوقعات اليومية هنا فور تفعيل خدمة الطقس.</div>
        </div>
      </div>
    ` : emptyState({
      iconName: 'cloud',
      title: 'لا توجد وجهة محددة',
      desc: 'أضف مدينة الوجهة في صفحة بيانات الرحلة أولًا لعرض حالة الطقس المتوقعة خلال أيام سفرك.',
      actionLabel: 'إضافة بيانات الرحلة',
      actionAttrs: `onclick="navigate('/trip')"`,
    })}

    ${comingSoonNote('سيتم ربط الصفحة بخدمة طقس مجانية (Open-Meteo) لعرض توقعات حقيقية حسب مدينة الوجهة وتواريخ الرحلة في المرحلة القادمة.')}
  `;
}

registerRoute('/weather', renderWeather);
