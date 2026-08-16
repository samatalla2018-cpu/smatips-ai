// نظام توجيه بسيط قائم على الـ hash — يعمل بدون أي أدوات بناء
const routes = {};

function registerRoute(path, renderFn) {
  routes[path] = renderFn;
}

function currentPath() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path] = hash.split('?');
  return path === '' ? '/' : path;
}

function currentQuery() {
  const hash = location.hash.replace(/^#/, '');
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx + 1) : '');
  return params;
}

function navigate(path) {
  if (location.hash === `#${path}`) {
    render();
  } else {
    location.hash = path;
  }
}

function render() {
  const path = currentPath();
  const container = qs('#app-main');
  const fn = routes[path] || routes['/404'];
  window.scrollTo({ top: 0 });
  updateActiveNav(path);
  closeNavSheet();
  try {
    fn(container);
  } catch (err) {
    console.error('خطأ أثناء عرض الصفحة:', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('info', 26)}</div>
        <h3>حدث خطأ غير متوقع</h3>
        <p>تعذّر عرض هذه الصفحة. حاول إعادة تحميل الموقع.</p>
      </div>`;
  }
}

function updateActiveNav(path) {
  qsa('.nav-link, .bottom-nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.path === path);
  });
  const section = SECTIONS.find((s) => s.path === path);
  const titleEl = qs('#topbar-title');
  if (titleEl) titleEl.textContent = section ? section.title : 'SmaTrips AI';
}

window.addEventListener('hashchange', render);
window.registerRoute = registerRoute;
window.navigate = navigate;
window.currentPath = currentPath;
window.currentQuery = currentQuery;
window.renderRoute = render;
