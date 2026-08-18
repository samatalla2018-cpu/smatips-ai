// يبني صفحة HTML مستقلة وقابلة للطباعة تلخّص رحلة العميل الحالية، لتُحفظ وتُنزَّل من صفحة "رحلاتي"

function tripFileSectionHtml(title, bodyHtml) {
  if (!bodyHtml) return '';
  return `<section class="tf-section"><h2>${escapeHtml(title)}</h2>${bodyHtml}</section>`;
}

function buildTripFileHtml() {
  const data = store.data;
  const trip = data.trip;
  const dest = [trip.city, trip.country].filter(Boolean).join('، ');
  const days = [...data.days].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const activitiesByDay = {};
  data.activities.forEach((a) => {
    (activitiesByDay[a.dayId] ||= []).push(a);
  });
  Object.values(activitiesByDay).forEach((list) => list.sort((a, b) => (a.time || '').localeCompare(b.time || '')));

  const daysHtml = days.map((d) => {
    const items = (activitiesByDay[d.id] || []).map((a) => `
      <div class="tf-row">
        <div class="tf-time">${escapeHtml(a.time || '')}</div>
        <div>
          <div class="tf-row-title">${escapeHtml(a.title)}</div>
          ${a.notes ? `<div class="tf-row-notes">${escapeHtml(a.notes)}</div>` : ''}
        </div>
      </div>`).join('');
    return `
      <div class="tf-day">
        <h3>${escapeHtml(d.title || '')} ${d.date ? `— ${escapeHtml(formatDateAr(d.date))}` : ''}</h3>
        ${d.notes ? `<p class="tf-day-notes">${escapeHtml(d.notes)}</p>` : ''}
        ${items || '<p class="tf-empty">لا توجد أنشطة مضافة لهذا اليوم</p>'}
      </div>`;
  }).join('');

  const tasksHtml = data.tasks.length ? `<ul class="tf-list">${data.tasks.map((t) => `
    <li class="${t.done ? 'tf-done' : ''}">${escapeHtml(t.title)}${t.category ? ` <span class="tf-tag">${escapeHtml(t.category)}</span>` : ''}</li>`).join('')}</ul>` : '';

  const packingHtml = data.packing.length ? `<ul class="tf-list">${data.packing.map((p) => `
    <li class="${p.packed ? 'tf-done' : ''}">${escapeHtml(p.name)}${p.qty ? ` × ${escapeHtml(p.qty)}` : ''}${p.category ? ` <span class="tf-tag">${escapeHtml(p.category)}</span>` : ''}</li>`).join('')}</ul>` : '';

  const placesHtml = data.places.length ? `<div class="tf-grid">${data.places.map((p) => `
    <div class="tf-card">
      <div class="tf-row-title">${escapeHtml(p.name)}</div>
      ${p.notes ? `<div class="tf-row-notes">${escapeHtml(p.notes)}</div>` : ''}
    </div>`).join('')}</div>` : '';

  const title = trip.title || dest || 'رحلتي';

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — SmaTrips AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  :root{--primary:#8B5CF6;--primary-dark:#7C3AED;--text:#1E1A33;--text-muted:#6D6488;--border:#E3D8F7;--bg:#F7F3FF;--surface:#FFFFFF;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Cairo',sans-serif;background:var(--bg);color:var(--text);line-height:1.7;}
  .tf-wrap{max-width:760px;margin:0 auto;padding:28px 20px 60px;}
  .tf-header{background:linear-gradient(135deg,#AFA8F5,#C9C5FA);border-radius:20px;padding:24px;margin-bottom:22px;}
  .tf-brand{font-size:13px;font-weight:800;color:var(--primary-dark);margin-bottom:10px;}
  .tf-header h1{margin:0 0 6px;font-size:24px;}
  .tf-header .tf-meta{font-size:13.5px;color:#4B4470;font-weight:700;}
  .tf-section{margin-bottom:24px;}
  .tf-section h2{font-size:16px;border-bottom:2px solid var(--border);padding-bottom:8px;margin-bottom:12px;}
  .tf-day{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px;}
  .tf-day h3{margin:0 0 8px;font-size:14.5px;}
  .tf-day-notes{font-size:13px;color:var(--text-muted);margin:0 0 8px;}
  .tf-empty{font-size:13px;color:var(--text-muted);margin:0;}
  .tf-row{display:flex;gap:10px;padding:6px 0;border-top:1px dashed var(--border);}
  .tf-row:first-of-type{border-top:none;}
  .tf-time{font-weight:800;color:var(--primary-dark);font-size:13px;min-width:52px;}
  .tf-row-title{font-weight:700;font-size:13.5px;}
  .tf-row-notes{font-size:12.5px;color:var(--text-muted);}
  .tf-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;}
  .tf-list li{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13.5px;font-weight:700;}
  .tf-list li.tf-done{opacity:.55;text-decoration:line-through;}
  .tf-tag{font-size:11px;font-weight:800;color:var(--primary-dark);background:#EDE4FF;border-radius:999px;padding:2px 9px;margin-inline-start:6px;}
  .tf-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .tf-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;}
  .tf-print-btn{position:fixed;top:16px;left:16px;background:var(--primary);color:#fff;border:none;border-radius:12px;padding:10px 18px;font-weight:800;font-family:inherit;font-size:13.5px;cursor:pointer;box-shadow:0 8px 20px rgba(139,92,246,.35);}
  @media print { .tf-print-btn{display:none;} body{background:#fff;} .tf-header{background:#EDE4FF;} }
  @media (max-width:560px){ .tf-grid{grid-template-columns:1fr;} }
</style>
</head>
<body>
  <button class="tf-print-btn" onclick="window.print()">طباعة / حفظ PDF</button>
  <div class="tf-wrap">
    <div class="tf-header">
      <div class="tf-brand">SmaTrips AI — مساعد المسافر الذكي</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="tf-meta">
        ${dest ? escapeHtml(dest) : ''}
        ${trip.startDate ? ` · ${escapeHtml(formatDateAr(trip.startDate))}${trip.endDate ? ' ← ' + escapeHtml(formatDateAr(trip.endDate)) : ''}` : ''}
        ${trip.tripType ? ` · ${escapeHtml(trip.tripType)}` : ''}
      </div>
    </div>
    ${tripFileSectionHtml('جدول الرحلة اليومي', daysHtml)}
    ${tripFileSectionHtml('المهام', tasksHtml)}
    ${tripFileSectionHtml('قائمة الأغراض', packingHtml)}
    ${tripFileSectionHtml('الأماكن المحفوظة', placesHtml)}
  </div>
</body>
</html>`;
}

// ينزّل ملف رحلة محفوظ مسبقًا عبر الـ endpoint المحمي (يتحقق من الجلسة والملكية على السيرفر) — لا رابط مباشر أبدًا
async function downloadTripFile(id, title) {
  const res = await fetch(`/api/trips/${id}`, { credentials: 'same-origin' });
  if (!res.ok) {
    toast('تعذّر تنزيل الملف', 'error');
    return false;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title || 'رحلتي'}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

// يبني ملف الرحلة الحالي، يحفظه في حساب العميل عبر /api/trips، ثم ينزّله فورًا (بضغطة واحدة من العميل، بدون تنزيل تلقائي)
async function saveAndDownloadTripFile() {
  const html = buildTripFileHtml();
  const title = store.getTrip().title || 'رحلتي';
  const res = await fetch('/api/trips', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, html }),
  });
  if (!res.ok) {
    toast('تعذّر حفظ ملف الرحلة', 'error');
    return null;
  }
  const { trip } = await res.json();
  await downloadTripFile(trip.id, trip.title);
  return trip;
}

window.buildTripFileHtml = buildTripFileHtml;
window.downloadTripFile = downloadTripFile;
window.saveAndDownloadTripFile = saveAndDownloadTripFile;
