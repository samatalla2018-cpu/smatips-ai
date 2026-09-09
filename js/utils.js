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

// تاريخ اليوم بصيغة YYYY-MM-DD محليًا (وليس UTC) — يُستخدم كحد أدنى افتراضي لمنتقي التاريخ
// (js/datepicker.js) حتى لا تُختار أي تواريخ ماضية.
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

// جلب إحداثيات مدينة عبر Nominatim/OpenStreetMap (مجاني، بدون مفتاح، يدعم البحث بالعربية) مع تخزين مؤقت
const _geocodeCache = {};
async function geocodeCity(query) {
  if (!query) return null;
  const key = query.trim().toLowerCase();
  if (key in _geocodeCache) return _geocodeCache[key];
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=ar`);
    if (!res.ok) throw new Error('geocoding request failed');
    const data = await res.json();
    const first = data[0];
    let result = null;
    if (first) {
      const parts = first.display_name.split(',').map((s) => s.trim());
      result = { lat: Number(first.lat), lon: Number(first.lon), name: parts[0], country: parts[parts.length - 1] };
    }
    _geocodeCache[key] = result;
    return result;
  } catch (e) {
    console.error('تعذّر تحديد إحداثيات المدينة', e);
    _geocodeCache[key] = null;
    return null;
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('geolocation not supported')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 10000 }
    );
  });
}

function money(n) {
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  if (isNaN(num)) return '';
  return num.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
}

// حركة دخول لطيفة (Fade + Slide) لأي عنصر يحمل data-animate — تُستدعى تلقائيًا بعد كل تنقّل
// (انظر router.js) وأيضًا يدويًا بعد إدراج HTML ديناميكي (مثل نتائج fetch) عند الحاجة.
function initAnimate(root = document) {
  const els = root.querySelectorAll ? Array.from(root.querySelectorAll('[data-animate]')) : [];
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in-view'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}

// تحقق مشترك من حالة رحلة معيّنة (ملكية + دفع حقيقي) — تستخدمه كل الصفحات التي تحتاج معرفة إن
// كانت رحلة ما مفتوحة (بيانات الرحلة، الجدول اليومي، شاشة نجاح الدفع...) بدل تكرار نفس نداء
// fetch('/api/trips') في كل صفحة على حدة. المصدر الوحيد للحقيقة يبقى استجابة الخادم نفسها —
// هذا مجرد تخزين مؤقت قصير (10 ثوانٍ) لتفادي تكرار الطلب أثناء نفس التنقّل، وليس قرارًا محليًا.
let _tripAccessCache = { tripId: null, at: 0, data: null };
async function getTripAccess(tripId) {
  if (!tripId) return { found: false, unlocked: false, trip: null };
  if (_tripAccessCache.tripId === tripId && Date.now() - _tripAccessCache.at < 10000) {
    return _tripAccessCache.data;
  }
  let result;
  try {
    const res = await fetch('/api/trips', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('failed');
    const { trips } = await res.json();
    const mine = trips.find((t) => t.id === tripId);
    result = { found: !!mine, unlocked: !!(mine && mine.unlocked), trip: mine || null };
  } catch {
    result = { found: false, unlocked: false, trip: null };
  }
  _tripAccessCache = { tripId, at: Date.now(), data: result };
  return result;
}
// يُستدعى بعد أي حدث يغيّر حالة الدفع فعليًا (مثل رجوع ناجح من الدفع) حتى لا تُستخدم نتيجة قديمة
function invalidateTripAccessCache() { _tripAccessCache = { tripId: null, at: 0, data: null }; }

window.getTripAccess = getTripAccess;
window.invalidateTripAccessCache = invalidateTripAccessCache;
window.todayISO = todayISO;
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
window.initAnimate = initAnimate;
