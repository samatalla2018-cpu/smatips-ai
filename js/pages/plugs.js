// صفحة أنواع المقابس الكهربائية

// المحتوى الحقيقي لصفحة المقابس — يُستدعى فقط بعد تأكيد أن الرحلة مفتوحة فعليًا (أو لا وجود
// لرحلة بعد أصلًا). renderPlugs أدناه هو المسؤول الوحيد عن قرار الفتح/القفل.
function renderPlugsContent(container) {
  const trip = store.getTrip();
  const info = trip.country ? PLUG_REFERENCE[trip.country] : null;

  container.innerHTML = `
    ${pageHeader({ title: 'المقابس الكهربائية', desc: 'تأكد من نوع المقبس والفولتية في وجهتك', iconName: 'plug' })}

    ${trip.country ? (info ? `
      <div class="card">
        <div class="flex items-center gap-3">
          <div class="page-header-icon" style="width:52px;height:52px;border-radius:14px;">${icon('plug', 24)}</div>
          <div>
            <div class="font-bold">${escapeHtml(trip.country)}</div>
            <div class="text-sm text-muted">الفولتية: ${info.voltage} · التردد: ${info.freq}</div>
          </div>
        </div>
        <div class="flex gap-2 mt-3" style="flex-wrap:wrap;">
          ${info.types.map((t) => `<span class="badge badge-primary">نوع ${t}</span>`).join('')}
        </div>
        <hr class="sep" />
        <p class="text-sm text-muted">إذا كانت مقابسك الحالية من نوع مختلف، تأكد من إحضار محوّل كهربائي مناسب قبل السفر. يمكنك إضافة هذا كمهمة في صفحة المهام.</p>
        <a href="#/tasks" class="btn btn-outline btn-sm mt-2">${icon('check', 15)}<span>إضافة "شراء محوّل كهربائي" للمهام</span></a>
      </div>
    ` : `
      <div class="card">
        <div class="flex items-center gap-3">
          <div class="page-header-icon" style="width:52px;height:52px;border-radius:14px;">${icon('info', 24)}</div>
          <div>
            <div class="font-bold">${escapeHtml(trip.country)}</div>
            <div class="text-sm text-muted">لا تتوفر بيانات مقابس لهذه الدولة بعد في قائمتنا المرجعية.</div>
          </div>
        </div>
      </div>
    `) : emptyState({
      iconName: 'plug',
      title: 'لا توجد وجهة محددة',
      desc: 'أضف دولة الوجهة في صفحة بيانات الرحلة لعرض نوع المقبس والفولتية المستخدمة هناك.',
      actionLabel: 'إضافة بيانات الرحلة',
      actionAttrs: `onclick="navigate('/trip')"`,
    })}

    <div class="section-title-row"><h2>دول مدعومة حاليًا</h2></div>
    <div class="chip-row">
      ${Object.keys(PLUG_REFERENCE).map((c) => `<button class="chip" data-country="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}
    </div>
  `;

  qsa('[data-country]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.updateTrip({ country: btn.dataset.country });
      renderPlugsContent(container);
    });
  });
}

// نقطة الدخول الوحيدة للراوت: مرجع المقابس ميزة مدفوعة — تُقفَل فقط عند وجود رحلة محفوظة
// (fail-closed)؛ بلا trip_id تبقى الصفحة متاحة كأداة عامة (لا رحلة لتقييدها).
function renderPlugs(container) {
  const trip = store.getTrip();
  if (!trip.id) {
    renderPlugsContent(container);
    return;
  }

  container.innerHTML = `
    ${pageHeader({ title: 'المقابس الكهربائية', desc: 'نوع المقبس والفولتية في بلد الوجهة', iconName: 'plug' })}
    <div class="flex items-center gap-2 text-sm text-muted" style="padding:20px 0;"><span class="spinner"></span><span>جارٍ التحقق من صلاحيتك...</span></div>
  `;

  getTripAccess(trip.id).then((access) => {
    if (access.unlocked) {
      renderPlugsContent(container);
      return;
    }
    container.innerHTML = lockedFeatureHtml({
      iconName: 'plug',
      title: 'معلومات المقابس جزء من خطتك الكاملة',
      desc: 'افتح خطتك الكاملة لمعرفة نوع المقبس والفولتية في وجهتك.',
      tripId: trip.id,
    });
    if (window.initAnimate) initAnimate(container);
  });
}

registerRoute('/plugs', renderPlugs);
