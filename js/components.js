// مكونات HTML قابلة لإعادة الاستخدام عبر الصفحات

function pageHeader({ title, desc, iconName, actions = '' }) {
  return `
    <div class="page-header">
      <div class="page-header-title-row">
        <div class="page-header-icon">${icon(iconName, 22)}</div>
        <div>
          <h1>${escapeHtml(title)}</h1>
          ${desc ? `<div class="desc">${escapeHtml(desc)}</div>` : ''}
        </div>
      </div>
      ${actions ? `<div class="flex gap-2">${actions}</div>` : ''}
    </div>`;
}

function emptyState({ iconName = 'info', title, desc, actionLabel, actionAttrs = '' }) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon(iconName, 26)}</div>
      <h3>${escapeHtml(title)}</h3>
      ${desc ? `<p>${escapeHtml(desc)}</p>` : ''}
      ${actionLabel ? `<button class="btn btn-primary btn-sm mt-2" ${actionAttrs}>${icon('plus', 16)}<span>${escapeHtml(actionLabel)}</span></button>` : ''}
    </div>`;
}

window.pageHeader = pageHeader;
window.emptyState = emptyState;
