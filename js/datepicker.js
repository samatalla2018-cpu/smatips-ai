// منتقي تاريخ احترافي (تقويم شهري داخل النافذة المنبثقة الحالية modal.js) — بديل لحقلَي
// input[type=date] الأصليين في نموذج بيانات الرحلة. يمنع اختيار أي تاريخ قبل الحد الأدنى (minISO)
// بصريًا ووظيفيًا من الأساس (زر disabled فعليًا، لا مجرد رسالة خطأ بعد الاختيار)، بدل الاعتماد على
// خاصية min في input[type=date] التي يختلف سلوكها البصري بين المتصفحات ولا تُظهر الأيام الماضية
// باهتة بشكل موحّد. لا يعتمد على أي مكتبة خارجية.

function dpPad2(n) { return String(n).padStart(2, '0'); }
function dpIsoOf(year, month, day) { return `${year}-${dpPad2(month + 1)}-${dpPad2(day)}`; }

function dpCalendarGridHtml(viewYear, viewMonth, { selectedISO, minISO }) {
  const today = todayISO();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0 = الأحد
  const numDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += `<span class="dp-cell"></span>`;
  for (let d = 1; d <= numDays; d++) {
    const iso = dpIsoOf(viewYear, viewMonth, d);
    const isPast = !!minISO && iso < minISO;
    const cls = ['dp-day'];
    if (iso === selectedISO) cls.push('dp-selected');
    if (iso === today) cls.push('dp-today');
    if (isPast) cls.push('dp-disabled');
    cells += `<button type="button" class="${cls.join(' ')}" data-date="${iso}"${isPast ? ' disabled aria-disabled="true"' : ''}>${d}</button>`;
  }
  return cells;
}

function dpBodyHtml(viewYear, viewMonth, opts) {
  return `
    <div class="dp">
      <div class="dp-header">
        <button type="button" class="icon-btn" id="dp-next-btn" aria-label="الشهر التالي">${icon('chevron', 16)}</button>
        <div class="dp-month-label" id="dp-month-label">${MONTHS_AR[viewMonth]} ${viewYear}</div>
        <button type="button" class="icon-btn" id="dp-prev-btn" aria-label="الشهر السابق" style="transform:rotate(180deg);">${icon('chevron', 16)}</button>
      </div>
      <div class="dp-weekdays">${WEEKDAYS_AR.map((w) => `<span>${w.slice(2, 5)}</span>`).join('')}</div>
      <div class="dp-grid" id="dp-grid">${dpCalendarGridHtml(viewYear, viewMonth, opts)}</div>
      <div class="dp-legend">
        <span class="dp-legend-item"><i class="dp-dot dp-dot-today"></i>اليوم</span>
        <span class="dp-legend-item"><i class="dp-dot dp-dot-selected"></i>المختار</span>
        <span class="dp-legend-item"><i class="dp-dot dp-dot-disabled"></i>غير متاح</span>
      </div>
    </div>`;
}

// title: عنوان النافذة. initialISO: القيمة الحالية (إن وُجدت). minISO: أقدم تاريخ مسموح به —
// كل ما قبله Disabled فعليًا في الشبكة نفسها. onSelect(iso): تُستدعى فور اختيار يوم صالح فقط
// (الأزرار المعطّلة لا يمكن النقر عليها من الأساس، فلا حاجة لأي تحقق لاحقًا هنا).
function openDatePicker({ title, initialISO, minISO, onSelect }) {
  const base = initialISO && (!minISO || initialISO >= minISO) ? initialISO : (minISO || todayISO());
  const [y, m] = base.split('-').map(Number);
  let viewYear = y;
  let viewMonth = m - 1;

  openModal(title, dpBodyHtml(viewYear, viewMonth, { selectedISO: initialISO, minISO }), () => {
    function rerender() {
      qs('#dp-grid').innerHTML = dpCalendarGridHtml(viewYear, viewMonth, { selectedISO: initialISO, minISO });
      qs('#dp-month-label').textContent = `${MONTHS_AR[viewMonth]} ${viewYear}`;
    }
    qs('#dp-prev-btn').addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      rerender();
    });
    qs('#dp-next-btn').addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      rerender();
    });
    qs('#dp-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('.dp-day');
      if (!btn || btn.disabled) return;
      const iso = btn.dataset.date;
      closeModal();
      onSelect(iso);
    });
  });
}

window.openDatePicker = openDatePicker;
