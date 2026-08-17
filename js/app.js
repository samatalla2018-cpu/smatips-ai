// نقطة انطلاق التطبيق: بناء القوائم، شيت الجوال، البحث السريع، وربط التوجيه

function buildSidebar() {
  const list = qs('#sidebar-nav');
  list.innerHTML = SECTIONS.map((s) => `
    <a class="nav-link" href="#${s.path}" data-path="${s.path}">
      ${icon(s.icon, 19)}
      <span>${escapeHtml(s.title)}</span>
    </a>`).join('');
}

function buildBottomNav() {
  const wrap = qs('#bottom-nav');
  const map = {
    dashboard: SECTIONS.find((s) => s.id === 'dashboard'),
    itinerary: SECTIONS.find((s) => s.id === 'itinerary'),
    tasks: SECTIONS.find((s) => s.id === 'tasks'),
    places: SECTIONS.find((s) => s.id === 'places'),
  };
  wrap.innerHTML = `
    <a class="bottom-nav-item" href="#${map.dashboard.path}" data-path="${map.dashboard.path}">${icon('home', 21)}<span>${map.dashboard.short}</span></a>
    <a class="bottom-nav-item" href="#${map.itinerary.path}" data-path="${map.itinerary.path}">${icon('calendar', 21)}<span>${map.itinerary.short}</span></a>
    <a class="bottom-nav-item" href="#${map.tasks.path}" data-path="${map.tasks.path}">${icon('check', 21)}<span>${map.tasks.short}</span></a>
    <a class="bottom-nav-item" href="#${map.places.path}" data-path="${map.places.path}">${icon('map', 21)}<span>${map.places.short}</span></a>
    <button class="bottom-nav-item" id="more-nav-btn" type="button">${icon('menu', 21)}<span>المزيد</span></button>
  `;
  qs('#more-nav-btn').addEventListener('click', openNavSheet);
}

function buildNavSheet() {
  const list = qs('#nav-sheet-list');
  list.innerHTML = SECTIONS.map((s) => `
    <a class="nav-link" href="#${s.path}" data-path="${s.path}">
      ${icon(s.icon, 19)}
      <span>${escapeHtml(s.title)}</span>
    </a>`).join('');
}

function openNavSheet() {
  qs('#nav-sheet-overlay').classList.add('open');
}
function closeNavSheet() {
  const el = qs('#nav-sheet-overlay');
  if (el) el.classList.remove('open');
}

function openSearch() {
  qs('#search-overlay').classList.add('open');
  const input = qs('#search-input');
  input.value = '';
  renderSearchResults('');
  setTimeout(() => input.focus(), 60);
}
function closeSearch() {
  qs('#search-overlay').classList.remove('open');
}

function buildSearchIndex(query) {
  const q = query.trim().toLowerCase();
  const data = store.data;
  const results = { places: [], tasks: [], days: [], links: [], services: [], packing: [] };
  if (!q) return results;

  data.places.forEach((p) => { if (p.name && p.name.toLowerCase().includes(q)) results.places.push(p); });
  data.tasks.forEach((t) => { if (t.title && t.title.toLowerCase().includes(q)) results.tasks.push(t); });
  data.days.forEach((d) => { if ((d.title || '').toLowerCase().includes(q)) results.days.push(d); });
  data.links.forEach((l) => { if (l.title && l.title.toLowerCase().includes(q)) results.links.push(l); });
  data.services.forEach((s) => { if (s.title && s.title.toLowerCase().includes(q)) results.services.push(s); });
  data.packing.forEach((p) => { if (p.name && p.name.toLowerCase().includes(q)) results.packing.push(p); });
  return results;
}

const GROUP_META = {
  places: { label: 'الأماكن', icon: 'map', path: '/places' },
  tasks: { label: 'المهام', icon: 'check', path: '/tasks' },
  days: { label: 'أيام الجدول', icon: 'calendar', path: '/itinerary' },
  links: { label: 'الروابط والحجوزات', icon: 'link', path: '/links' },
  services: { label: 'الخدمات', icon: 'star', path: '/services' },
  packing: { label: 'قائمة الأغراض', icon: 'bag', path: '/packing' },
};

function renderSearchResults(query) {
  const host = qs('#search-results');
  const q = query.trim();
  if (!q) {
    host.innerHTML = `<div class="empty-state" style="padding:28px 16px; border:none;">
      <div class="empty-state-icon">${icon('search', 22)}</div>
      <h3>ابحث في رحلتك</h3>
      <p>اكتب اسم مكان، مهمة، رابط أو يوم من جدولك للوصول إليه بسرعة.</p>
    </div>`;
    return;
  }
  const results = buildSearchIndex(q);
  const totalCount = Object.values(results).reduce((a, arr) => a + arr.length, 0);
  if (totalCount === 0) {
    host.innerHTML = `<div class="empty-state" style="padding:28px 16px; border:none;">
      <div class="empty-state-icon">${icon('search', 22)}</div>
      <h3>لا توجد نتائج</h3>
      <p>لم نجد أي نتيجة مطابقة لـ "${escapeHtml(q)}"</p>
    </div>`;
    return;
  }
  let html = '';
  for (const [key, items] of Object.entries(results)) {
    if (!items.length) continue;
    const meta = GROUP_META[key];
    html += `<div class="search-result-group-label">${escapeHtml(meta.label)}</div>`;
    items.slice(0, 6).forEach((item) => {
      const title = item.name || item.title || 'بدون عنوان';
      const sub = item.city || item.category || item.dueDate || '';
      html += `
        <a class="search-result-item" href="#${meta.path}" data-close-search="1">
          <div class="icon-wrap">${icon(meta.icon, 17)}</div>
          <div>
            <div class="search-result-title">${escapeHtml(title)}</div>
            ${sub ? `<div class="search-result-sub">${escapeHtml(sub)}</div>` : ''}
          </div>
        </a>`;
    });
  }
  host.innerHTML = html;
}

function wireGlobalUI() {
  qs('#search-open-btn').addEventListener('click', openSearch);
  qs('#search-open-btn-desktop').addEventListener('click', openSearch);
  qs('#search-close-btn').addEventListener('click', closeSearch);
  qs('#search-overlay').addEventListener('click', (e) => { if (e.target.id === 'search-overlay') closeSearch(); });
  qs('#search-input').addEventListener('input', debounce((e) => renderSearchResults(e.target.value), 120));
  qs('#search-results').addEventListener('click', (e) => {
    if (e.target.closest('[data-close-search]')) closeSearch();
  });

  qs('#menu-open-btn').addEventListener('click', openNavSheet);
  qs('#nav-sheet-close-btn').addEventListener('click', closeNavSheet);
  qs('#nav-sheet-overlay').addEventListener('click', (e) => { if (e.target.id === 'nav-sheet-overlay') closeNavSheet(); });
  qs('#nav-sheet-list').addEventListener('click', closeNavSheet);

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape') { closeSearch(); closeNavSheet(); closeModal(); }
  });
}

function injectStaticIcons() {
  qs('#menu-open-btn').innerHTML = icon('menu', 20);
  qs('#search-open-btn').innerHTML = icon('search', 19);
  qs('#search-close-btn').innerHTML = icon('x', 16);
  qs('#nav-sheet-close-btn').innerHTML = icon('x', 18);
  qs('#modal-close-btn').innerHTML = icon('x', 18);
}

document.addEventListener('DOMContentLoaded', () => {
  injectStaticIcons();
  buildSidebar();
  buildBottomNav();
  buildNavSheet();
  wireGlobalUI();
  wireModal();
  renderRoute();
});
