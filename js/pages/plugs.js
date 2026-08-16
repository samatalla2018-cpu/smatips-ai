// صفحة أنواع المقابس الكهربائية

function renderPlugs(container) {
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
      renderPlugs(container);
    });
  });
}

registerRoute('/plugs', renderPlugs);
