// دوال مساعدة عامة تُستخدم في أنحاء التطبيق

function uid() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const WEEKDAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function formatDateAr(dateStr, opts = {}) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const parts = [];
  if (opts.weekday !== false) parts.push(WEEKDAYS_AR[d.getDay()]);
  parts.push(`${d.getDate()} ${MONTHS_AR[d.getMonth()]}`);
  if (opts.year !== false) parts.push(d.getFullYear());
  return parts.join(opts.weekday !== false ? '، ' : ' ');
}

function daysBetween(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  return Math.max(0, Math.round((end - start) / 86400000) + 1);
}

function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

// روابط خرائط Google الحقيقية (بدون أي مفتاح API) — تعمل فعليًا على كل الأجهزة
function mapsSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
function mapsDirectionsUrl(destination) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
// رابط تضمين خرائط جوجل بدون مفتاح API (يعمل داخل iframe فعليًا)
function mapsEmbedUrl(query) {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}
// هل الرابط المُدخل هو رابط Google Maps صالح؟
function isValidMapsUrl(url) {
  try {
    const u = new URL(url);
    return /(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname.includes('/maps');
  } catch {
    return false;
  }
}

function toast(msg, type = 'info') {
  const host = qs('#toast-host');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

function money(n) {
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  if (isNaN(num)) return '';
  return num.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
}

window.uid = uid;
window.escapeHtml = escapeHtml;
window.formatDateAr = formatDateAr;
window.daysBetween = daysBetween;
window.debounce = debounce;
window.qs = qs;
window.qsa = qsa;
window.mapsSearchUrl = mapsSearchUrl;
window.mapsDirectionsUrl = mapsDirectionsUrl;
window.mapsEmbedUrl = mapsEmbedUrl;
window.isValidMapsUrl = isValidMapsUrl;
window.toast = toast;
window.money = money;
