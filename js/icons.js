// مكتبة أيقونات SVG بسيطة (خطية) بدون الاعتماد على أي مصدر خارجي
const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/><path d="M10 20v-6h4v6"/>',
  passport: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M9.5 15.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/><path d="M9 19h6"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16"/><path d="M8 3v3M16 3v3"/><path d="M8.5 13.5h1M12 13.5h1M15.5 13.5h1M8.5 16.5h1M12 16.5h1"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.3 2.3 4.7-5"/>',
  bag: '<path d="M8 8V6a4 4 0 0 1 8 0v2"/><rect x="4.5" y="8" width="15" height="12" rx="2"/><path d="M8 11.5v2M16 11.5v2"/>',
  map: '<path d="M12 21s-6.5-6.1-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.2 4 4 0 0 1 16.5 18H7z"/>',
  currency: '<circle cx="9" cy="9" r="5.5"/><circle cx="15" cy="15" r="5.5"/>',
  plug: '<path d="M9 3v5M15 3v5"/><rect x="6.5" y="8" width="11" height="6" rx="2"/><path d="M12 14v3a3 3 0 0 1-3 3H7"/>',
  link: '<path d="M9.5 14.5l5-5"/><path d="M8 16.5l-1.8 1.8a3.2 3.2 0 0 1-4.5-4.5L4 11.5"/><path d="M16 7.5l1.8-1.8a3.2 3.2 0 0 1 4.5 4.5L20.5 12"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="M15 6l-6 6 6 6"/>',
  edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13 6.5l4.5 4.5"/>',
  trash: '<path d="M5 7h14"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M7 7l1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  external: '<path d="M14 5h5v5"/><path d="M19 5l-9 9"/><path d="M18 13.5V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V7.5A1.5 1.5 0 0 1 6 6h4.5"/>',
  navigation: '<path d="M12 3l7.5 17-7.5-4-7.5 4z"/>',
  sparkle: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.8v.2"/>',
  wallet: '<rect x="3.5" y="6" width="17" height="12.5" rx="2"/><path d="M3.5 10h17"/><circle cx="16.5" cy="14" r="1.1"/>',
  suitcase: '<rect x="3.5" y="7.5" width="17" height="11.5" rx="2"/><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5"/><path d="M3.5 12.5h17"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.5 2.3 3.8 5.3 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.3-3.8-8.5s1.3-6.2 3.8-8.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3.5v2M12 18.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3.5 12h2M18.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M19.5 14.8A8 8 0 1 1 9.2 4.5a6.5 6.5 0 0 0 10.3 10.3z"/>',
  cloudSun: '<circle cx="7.3" cy="7" r="2.4"/><path d="M7.3 3v1.2M3.1 7h1.2M7.3 11v-1.2M4.5 4.2l.85.85M10.1 4.2l-.85.85" stroke-width="1.5"/><path d="M9 18.5a3.8 3.8 0 0 1-.4-7.5A5.2 5.2 0 0 1 18.5 9.8a3.8 3.8 0 0 1-.6 8.7H9z"/>',
  cloudMoon: '<path d="M9.9 7.3A3.3 3.3 0 0 0 13.6 3a4.1 4.1 0 1 1-4.5 6.4 3.3 3.3 0 0 0 .8-2.1z"/><path d="M9 18.5a3.8 3.8 0 0 1-.4-7.5A5.2 5.2 0 0 1 18.5 9.8a3.8 3.8 0 0 1-.6 8.7H9z"/>',
  cloudFog: '<path d="M6.5 12.2a3.5 3.5 0 0 1 .2-7A5 5 0 0 1 16 6.4 3.5 3.5 0 0 1 15.7 12.7H6.5z"/><path d="M4 16h16M6 19.5h12"/>',
  cloudRain: '<path d="M6.5 10.2a3.5 3.5 0 0 1 .2-7A5 5 0 0 1 16 4.4 3.5 3.5 0 0 1 15.7 10.7H6.5z"/><path d="M8 14.5l-1.3 3M13 14.5l-1.3 3M18 14.5l-1.3 3"/>',
  cloudSnow: '<path d="M6.5 10.2a3.5 3.5 0 0 1 .2-7A5 5 0 0 1 16 4.4 3.5 3.5 0 0 1 15.7 10.7H6.5z"/><path d="M8 14.8v4.4M6.2 16.1l3.6 1.8M6.2 17.9l3.6-1.8"/><path d="M16 14.8v4.4M14.2 16.1l3.6 1.8M14.2 17.9l3.6-1.8"/>',
  cloudStorm: '<path d="M6.5 10.2a3.5 3.5 0 0 1 .2-7A5 5 0 0 1 16 4.4 3.5 3.5 0 0 1 15.7 10.7H6.5z"/><path d="M12.5 13l-2.3 4h3l-2 4.5"/>',
  droplet: '<path d="M12 3.5C9 8 6.5 11.3 6.5 14.5a5.5 5.5 0 0 0 11 0C17.5 11.3 15 8 12 3.5z"/>',
  wind: '<path d="M3 8h9.5a2.5 2.5 0 1 0-2.3-3.4"/><path d="M3 12.5h13.5a2.5 2.5 0 1 1-2.3 3.4"/><path d="M3 17h7.5a2.5 2.5 0 1 1-2.3 3.4"/>',
  chevronUp: '<path d="M6 15l6-6 6 6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
};

function icon(name, size = 22, extraClass = '') {
  const body = ICONS[name] || ICONS.info;
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

window.icon = icon;
