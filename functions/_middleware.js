import { readSessionCookie, verifySessionToken } from './_utils.js';

const BRAND_STYLE = `
  :root{--bg:#F5FAF9;--surface:#FFFFFF;--border:#DCEEE9;--text:#0E2A2B;--text-muted:#5D7B7A;--primary:#0D9C8F;--primary-dark:#0A7A70;--sky:#29A7DE;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Cairo',sans-serif;background:radial-gradient(circle at 20% 0%, rgba(13,156,143,.10), transparent 55%), radial-gradient(circle at 100% 20%, rgba(41,167,222,.08), transparent 45%), var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
  .box{background:var(--surface);border:1px solid var(--border);border-radius:22px;padding:28px 24px;max-width:400px;width:100%;box-shadow:0 16px 40px rgba(9,46,45,.12);}
  h1{font-size:19px;margin:0 0 6px;text-align:center;}
  p.sub{font-size:13px;color:var(--text-muted);text-align:center;margin:0 0 20px;}
  label{font-size:13px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px;}
  input{width:100%;height:46px;border-radius:13px;border:1px solid var(--border);padding:0 14px;font-size:15px;font-family:inherit;margin-bottom:14px;outline:none;}
  input:focus{border-color:var(--primary);}
  button{width:100%;height:48px;border-radius:999px;border:none;background:linear-gradient(135deg,var(--primary),var(--sky));color:#fff;font-weight:800;font-size:14.5px;cursor:pointer;box-shadow:0 10px 24px rgba(13,156,143,.28);}
  button:hover{filter:brightness(1.06);}
  button:disabled{opacity:.6;cursor:not-allowed;}
  button.ghost{background:transparent;color:var(--text-muted);font-weight:700;margin-top:10px;box-shadow:none;}
  .msg{font-size:13px;text-align:center;margin-top:12px;min-height:18px;}
  .msg.error{color:#E11D48;}
  .msg.success{color:#16A34A;}
  .step{display:none;}
  .step.active{display:block;}
  .price{text-align:center;font-size:30px;font-weight:800;color:var(--primary-dark);margin:8px 0 4px;}
  .price span{font-size:14px;color:var(--text-muted);font-weight:700;}
  .spinner{width:26px;height:26px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--primary);animation:spin .8s linear infinite;margin:6px auto 14px;}
  @keyframes spin{to{transform:rotate(360deg);}}
`;

// أيقونات SVG بسيطة (مطابقة لمكتبة js/icons.js) لصفحة الهبوط — لا حاجة لتحميل icons.js قبل الدخول
const LP_ICON_PATHS = {
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16"/><path d="M8 3v3M16 3v3"/><path d="M8.5 13.5h1M12 13.5h1M15.5 13.5h1M8.5 16.5h1M12 16.5h1"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.2 4 4 0 0 1 16.5 18H7z"/>',
  currency: '<circle cx="9" cy="9" r="5.5"/><circle cx="15" cy="15" r="5.5"/>',
  bag: '<path d="M8 8V6a4 4 0 0 1 8 0v2"/><rect x="4.5" y="8" width="15" height="12" rx="2"/><path d="M8 11.5v2M16 11.5v2"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.3 2.3 4.7-5"/>',
  plug: '<path d="M9 3v5M15 3v5"/><rect x="6.5" y="8" width="11" height="6" rx="2"/><path d="M12 14v3a3 3 0 0 1-3 3H7"/>',
  map: '<path d="M12 21s-6.5-6.1-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  link: '<path d="M9.5 14.5l5-5"/><path d="M8 16.5l-1.8 1.8a3.2 3.2 0 0 1-4.5-4.5L4 11.5"/><path d="M16 7.5l1.8-1.8a3.2 3.2 0 0 1 4.5 4.5L20.5 12"/>',
  sparkle: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/><circle cx="12" cy="12" r="3"/>',
  layers: '<path d="M12 3.5l8 4.3-8 4.3-8-4.3z"/><path d="M4 12.2l8 4.3 8-4.3M4 15.9l8 4.3 8-4.3"/>',
  phone: '<path d="M6.3 3.5h3l1.3 3.9-2 1.4a13.2 13.2 0 0 0 6.4 6.4l1.4-2 3.9 1.3v3a2 2 0 0 1-2.2 2C10.6 19 5 13.4 4.5 5.7a2 2 0 0 1 1.8-2.2z"/>',
};
function lpIcon(name, size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${LP_ICON_PATHS[name] || ''}</svg>`;
}
const LP_WHATSAPP_ICON = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 3.5a8.4 8.4 0 0 0-7.2 12.7L3.5 20.5l4.5-1.2A8.4 8.4 0 1 0 12 3.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.7 8.6c.2-.45.4-.46.6-.47.16 0 .35 0 .5.38.18.44.6 1.5.66 1.6.06.12.1.27 0 .43-.08.16-.13.26-.25.4-.13.14-.26.3-.37.4-.13.13-.26.26-.12.5.15.26.65 1.05 1.4 1.7.95.85 1.75 1.12 2 1.25.26.13.4.1.55-.06.15-.16.63-.72.8-.97.16-.25.33-.2.55-.12.23.08 1.45.68 1.7.8.25.13.42.19.48.3.06.12.06.65-.15 1.28-.22.62-1.28 1.18-1.77 1.25-.46.07-1 .1-1.62-.1-.37-.11-.85-.27-1.46-.53-2.58-1.13-4.27-3.72-4.4-3.9-.13-.18-1.05-1.4-1.05-2.68 0-1.28.66-1.9.9-2.16z" fill="currentColor" stroke="none"/></svg>';
const LP_TIKTOK_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M14.6 3v10.3a2.7 2.7 0 1 1-2.2-2.65" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M14.6 3.3c.4 2.15 2.05 3.7 4.1 3.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
const LP_MAIL_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5.5" width="17" height="13" rx="2.2" stroke="currentColor" stroke-width="1.8"/><path d="M4.3 7l7.7 6 7.7-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const LANDING_STYLE = `
  :root{--accent:#FF8A5B;--accent-dark:#E86A3C;--accent-light:#FFE9DE;--sky:#29A7DE;--sky-light:#E1F4FC;--primary-light:#D9F3EE;--text-faint:#93AEAB;}
  body{display:block;padding:0;align-items:initial;justify-content:initial;background:
    radial-gradient(circle at 12% 0%, rgba(13,156,143,.08), transparent 45%),
    radial-gradient(circle at 100% 15%, rgba(41,167,222,.08), transparent 40%),
    #FFFFFF;}
  .lp{max-width:1180px;margin:0 auto;padding:0 18px;}

  .lp-header{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;padding:14px 18px;max-width:1180px;margin:0 auto;background:rgba(255,255,255,.8);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}
  .lp-header img{height:34px;width:auto;}
  .lp-header .lp-brand-sub{font-size:11.5px;color:var(--text-muted);font-weight:700;margin-inline-start:auto;display:none;}

  .lp-eyebrow{display:inline-flex;align-items:center;gap:6px;padding:7px 15px;border-radius:999px;background:rgba(255,255,255,.85);color:var(--primary-dark);font-size:12px;font-weight:800;margin-bottom:16px;box-shadow:0 4px 14px rgba(9,46,45,.08);}

  /* ===== Hero بصورة سفر حقيقية بملء العرض — أول انطباع "بدأت رحلتي بالفعل" ===== */
  .lp-hero{position:relative;margin:10px 4px 0;border-radius:26px;overflow:hidden;isolation:isolate;min-height:78vw;box-shadow:0 20px 48px rgba(9,46,45,.16);}
  .lp-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;}
  .lp-hero-scrim{position:absolute;inset:0;z-index:-1;background:
    linear-gradient(0deg, rgba(6,26,28,.92) 0%, rgba(6,26,28,.55) 46%, rgba(6,26,28,.18) 100%);}
  .lp-hero-inner{display:flex;flex-direction:column;align-items:flex-start;padding:34px 20px 30px;color:#fff;}
  .lp-hero-text{text-align:right;width:100%;}
  .lp-hero h1{font-size:26px;line-height:1.34;font-weight:900;margin:0 0 12px;color:#fff;}
  .lp-hero p{font-size:14px;color:rgba(255,255,255,.9);max-width:520px;margin:0 0 22px;line-height:1.85;}
  .lp-hero-visual{display:none;}
  .lp-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:52px;padding:0 28px;border:none;border-radius:999px;background:linear-gradient(90deg,var(--accent),var(--accent-dark));color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 14px 30px rgba(232,106,60,.4);transition:transform .15s ease, box-shadow .15s ease;}
  .lp-cta:hover{transform:translateY(-1px);box-shadow:0 18px 34px rgba(232,106,60,.46);}
  .lp-cta:active{transform:translateY(0);}
  .lp-cta .gold-dot{width:7px;height:7px;border-radius:50%;background:#fff;opacity:.9;}

  .lp-cards{display:grid;grid-template-columns:1fr;gap:12px;padding:24px 4px 8px;}
  .lp-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:20px 18px;text-align:center;font-weight:700;font-size:14px;box-shadow:0 4px 16px rgba(9,46,45,.05);transition:transform .18s ease, box-shadow .18s ease;}
  .lp-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(9,46,45,.09);}

  .lp-section-title{text-align:center;font-size:21px;font-weight:900;margin:0 0 20px;}
  .lp-section-sub{text-align:center;font-size:13.5px;color:var(--text-muted);font-weight:600;margin:-12px 0 22px;}

  /* ===== شريط إلهام الوجهات — صور سفر حقيقية جذابة ===== */
  .lp-dest{padding:34px 4px 6px;}
  .lp-dest-strip{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 10px;scroll-snap-type:x proximity;scrollbar-width:none;}
  .lp-dest-strip::-webkit-scrollbar{display:none;}
  .lp-dest-card{position:relative;flex:0 0 auto;width:150px;height:194px;border-radius:20px;overflow:hidden;scroll-snap-align:start;box-shadow:0 4px 16px rgba(9,46,45,.08);}
  .lp-dest-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
  .lp-dest-scrim{position:absolute;inset:0;background:linear-gradient(0deg, rgba(6,26,28,.88) 0%, rgba(6,26,28,.05) 60%);}
  .lp-dest-info{position:absolute;inset-inline:0;bottom:0;padding:12px;color:#fff;}
  .lp-dest-name{font-size:13.5px;font-weight:800;}
  .lp-dest-country{font-size:10.5px;font-weight:700;color:rgba(255,255,255,.82);margin-top:2px;}

  .lp-features{padding:12px 4px 38px;}
  .lp-feat-grid{display:grid;grid-template-columns:1fr;gap:12px;}
  .lp-feat{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:18px 14px;text-align:center;box-shadow:0 4px 14px rgba(9,46,45,.05);transition:transform .18s ease, box-shadow .18s ease;}
  .lp-feat:hover{transform:translateY(-3px);box-shadow:0 12px 26px rgba(9,46,45,.09);}
  .lp-feat .icon-wrap{width:44px;height:44px;border-radius:13px;background:var(--primary-light);color:var(--primary-dark);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;}
  .lp-feat:nth-child(2n) .icon-wrap{background:var(--sky-light);color:#0E7FA8;}
  .lp-feat:nth-child(4n) .icon-wrap{background:var(--accent-light);color:var(--accent-dark);}
  .lp-feat span{font-size:12.5px;font-weight:700;line-height:1.5;display:block;}

  .lp-pitch{text-align:center;padding:14px 4px 40px;}
  .lp-pitch p{font-size:17px;font-weight:800;max-width:520px;margin:0 auto 22px;line-height:1.7;}
  .lp-pitch .gold-rule{width:52px;height:3px;border-radius:3px;background:linear-gradient(90deg,var(--primary),var(--sky));margin:0 auto 18px;}

  .lp-login-wrap{padding:6px 4px 50px;display:flex;justify-content:center;}
  .lp-login-wrap.hidden{display:none;}
  .lp-login-card.box{max-width:420px;border-radius:26px;padding:34px 26px;box-shadow:0 20px 48px rgba(9,46,45,.13);}
  .lp-login-icon{width:50px;height:50px;border-radius:15px;background:linear-gradient(135deg,var(--primary-light),var(--sky-light));color:var(--primary-dark);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;}

  .lp-footer{border-top:1px solid var(--border);padding:26px 4px 30px;text-align:center;}
  .lp-footer .lp-social-row{display:flex;justify-content:center;gap:12px;margin-bottom:12px;}
  .lp-footer .lp-social-icon{width:44px;height:44px;border-radius:50%;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-muted);transition:color .15s ease, border-color .15s ease, transform .15s ease;}
  .lp-footer .lp-social-icon:hover{color:var(--primary-dark);border-color:var(--primary);transform:translateY(-2px);}
  .lp-footer .lp-copy{font-size:11.5px;color:var(--text-faint,var(--text-muted));}

  [data-animate]{opacity:0;transform:translateY(14px);transition:opacity .5s ease, transform .5s ease;}
  [data-animate].in-view{opacity:1;transform:none;}
  @media (prefers-reduced-motion: reduce){[data-animate]{opacity:1;transform:none;transition:none;}}

  /* ===== تابلت ===== */
  @media (min-width:640px){
    .lp-header{padding:18px 20px;}
    .lp-hero{min-height:440px;}
    .lp-hero-inner{padding:52px 40px 44px;}
    .lp-hero h1{font-size:36px;}
    .lp-hero p{font-size:15.5px;}
    .lp-cards{grid-template-columns:repeat(3,1fr);gap:16px;}
    .lp-dest-card{width:180px;height:224px;}
    .lp-feat-grid{grid-template-columns:repeat(2,1fr);gap:14px;}
    .lp-pitch p{font-size:19px;}
  }

  /* ===== كمبيوتر مكتبي ===== */
  @media (min-width:1024px){
    .lp{padding:0 40px;}
    .lp-header{padding:20px 40px;}
    .lp-header img{height:38px;}
    .lp-header .lp-brand-sub{display:block;}

    .lp-hero{min-height:0;}
    .lp-hero-inner{padding:88px 64px 76px;align-items:center;}
    .lp-hero-text{text-align:center;max-width:680px;}
    .lp-hero-text .lp-eyebrow{margin-inline:auto;}
    .lp-hero h1{font-size:50px;line-height:1.22;}
    .lp-hero p{font-size:17px;max-width:560px;margin:0 auto 30px;}
    .lp-hero .lp-cta{margin:0 auto;}

    .lp-cards{gap:20px;padding:34px 4px 10px;}
    .lp-card{padding:26px 22px;font-size:15px;border-radius:20px;}

    .lp-dest{padding:46px 4px 10px;}
    .lp-dest-card{width:200px;height:250px;border-radius:22px;}

    .lp-features{padding:22px 4px 68px;}
    .lp-section-title{font-size:27px;}
    .lp-feat-grid{grid-template-columns:repeat(3,1fr);gap:18px;}
    .lp-feat{padding:24px 18px;border-radius:20px;}
    .lp-feat .icon-wrap{width:50px;height:50px;border-radius:14px;}
    .lp-feat span{font-size:13.5px;}

    .lp-pitch{padding:22px 4px 64px;}
    .lp-pitch p{font-size:22px;max-width:620px;}

    .lp-login-wrap{padding:12px 4px 72px;}
  }
`;

// وجهات سفر حقيقية جذابة تُعرض في شريط الإلهام — تزيين بصري بحت، لا علاقة له بأي بيانات مستخدم
const LP_DESTINATIONS = [
  { name: 'إسطنبول', country: 'تركيا', img: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=480&auto=format&fit=crop' },
  { name: 'سانتوريني', country: 'اليونان', img: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=480&auto=format&fit=crop' },
  { name: 'جزر المالديف', country: 'المالديف', img: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?q=80&w=480&auto=format&fit=crop' },
  { name: 'باريس', country: 'فرنسا', img: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=480&auto=format&fit=crop' },
  { name: 'أجرا', country: 'الهند', img: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=480&auto=format&fit=crop' },
  { name: 'البندقية', country: 'إيطاليا', img: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=480&auto=format&fit=crop' },
];

function destinationStripHtml() {
  return `
    <section class="lp-dest" data-animate>
      <h2 class="lp-section-title">وجهات يحبها مسافرونا</h2>
      <p class="lp-section-sub">أفكار تلهمك قبل ما تحدد وجهتك القادمة</p>
      <div class="lp-dest-strip">
        ${LP_DESTINATIONS.map((d) => `
          <div class="lp-dest-card">
            <img src="${d.img}" alt="${d.name}" loading="lazy" />
            <div class="lp-dest-scrim"></div>
            <div class="lp-dest-info">
              <div class="lp-dest-name">${d.name}</div>
              <div class="lp-dest-country">${d.country}</div>
            </div>
          </div>`).join('')}
      </div>
    </section>`;
}

// الأقسام التسويقية المشتركة لصفحة الهبوط (Hero + البطاقات + شريط الوجهات + المزايا + الدعوة للعمل) —
// تُستخدم دون أي تعديل في كل من صفحة تسجيل الدخول وصفحة الاشتراك بعد التحقق، حتى لا يفقد
// المستخدم سياق المنتج (المزايا والتسعير) في أي مرحلة من رحلته قبل الدفع.
function landingMarketingHtml() {
  return `
  <header class="lp-header">
    <img src="/assets/logo/logo-mark.png" alt="SmaTrips AI" />
    <div class="lp-brand-sub">مساعد المسافر الذكي</div>
  </header>

  <div class="lp">
    <section class="lp-hero" data-animate>
      <img class="lp-hero-img" src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1400&auto=format&fit=crop" alt="" />
      <div class="lp-hero-scrim"></div>
      <div class="lp-hero-inner">
        <div class="lp-hero-text">
          <span class="lp-eyebrow">${lpIcon('sparkle', 15)}مساعد سفرك الذكي</span>
          <h1>رتّب سفرتك كلها في مكان واحد</h1>
          <p>خطتك اليومية، مهامك، أغراض السفر، الطقس، العملات، المقابس والروابط المهمة… بدون تشتت بين الملاحظات والتطبيقات.</p>
          <button class="lp-cta" id="hero-cta" type="button"><span class="gold-dot"></span>ابدأ التخطيط الآن</button>
        </div>
      </div>
    </section>

    <section class="lp-cards" data-animate>
      <div class="lp-card">كل تفاصيل رحلتك في مكان واحد</div>
      <div class="lp-card">خطتك محفوظة وتفتحها من أي جهاز</div>
      <div class="lp-card">مساعد ذكي قبل السفر وأثناء الرحلة</div>
    </section>

    ${destinationStripHtml()}

    <section class="lp-features" data-animate>
      <h2 class="lp-section-title">ليش SmaTrips AI؟</h2>
      <div class="lp-feat-grid">
        <div class="lp-feat"><div class="icon-wrap">${lpIcon('calendar')}</div><span>جدول يومي مرتب للرحلة</span></div>
        <div class="lp-feat"><div class="icon-wrap">${lpIcon('cloud')}</div><span>الطقس حسب الوجهة</span></div>
        <div class="lp-feat"><div class="icon-wrap">${lpIcon('currency')}</div><span>تحويل العملات</span></div>
        <div class="lp-feat"><div class="icon-wrap">${lpIcon('bag')}</div><span>قائمة أغراض السفر</span></div>
        <div class="lp-feat"><div class="icon-wrap">${lpIcon('check')}</div><span>المهام والتذكيرات</span></div>
        <div class="lp-feat"><div class="icon-wrap">${lpIcon('plug')}</div><span>أنواع المقابس الكهربائية</span></div>
        <div class="lp-feat"><div class="icon-wrap">${lpIcon('map')}</div><span>روابط Google Maps</span></div>
        <div class="lp-feat"><div class="icon-wrap">${lpIcon('link')}</div><span>روابط الحجوزات والخدمات المفيدة</span></div>
      </div>
    </section>

    <section class="lp-pitch" data-animate>
      <div class="gold-rule"></div>
      <p>مو ناقصك أماكن أكثر… ناقصك طريقة أذكى ترتب فيها اللي عندك.</p>
      <button class="lp-cta" id="pitch-cta" type="button"><span class="gold-dot"></span>ابدأ تخطيط رحلتك الآن</button>
    </section>
`;
}

function landingFooterHtml() {
  return `
    <footer class="lp-footer" data-animate>
      <div class="lp-social-row">
        <a class="lp-social-icon" href="https://wa.me/966566529226" target="_blank" rel="noopener noreferrer" aria-label="تواصل عبر واتساب">${LP_WHATSAPP_ICON}</a>
        <a class="lp-social-icon" href="https://www.tiktok.com/@smatrips" target="_blank" rel="noopener noreferrer" aria-label="حساب تيك توك">${LP_TIKTOK_ICON}</a>
        <a class="lp-social-icon" href="mailto:smatrips52@gmail.com" aria-label="راسلنا عبر البريد الإلكتروني">${LP_MAIL_ICON}</a>
      </div>
      <div class="lp-copy">© 2026 SmaTrips AI — مساعد المسافر الذكي</div>
    </footer>
  </div>
`;
}

const LANDING_ANIMATE_SCRIPT = `
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in-view'); });
    }, { threshold: 0.12 });
    document.querySelectorAll('[data-animate]').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('[data-animate]').forEach((el) => el.classList.add('in-view'));
  }
`;

function loginHtml() {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SmaTrips AI — مساعد المسافر الذكي</title>
<meta name="description" content="رتّب سفرتك كلها في مكان واحد: خطتك اليومية، مهامك، أغراض السفر، الطقس، العملات، والمزيد." />
<meta name="theme-color" content="#0D9C8F" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<style>${BRAND_STYLE}${LANDING_STYLE}</style>
</head>
<body>
${landingMarketingHtml()}
    <div class="lp-login-wrap hidden" id="login-section" data-animate>
      <div class="box lp-login-card">
        <div class="lp-login-icon">${lpIcon('phone', 22)}</div>
        <h1>سجّل دخولك بجوالك</h1>
        <p class="sub">رمز تحقق قصير عبر SMS، بدون كلمة مرور</p>

        <div class="step active" id="step-phone">
          <label>رقم الجوال</label>
          <input type="tel" id="phone-input" placeholder="9665XXXXXXXX" autocomplete="off" inputmode="tel" />
          <button id="send-btn">إرسال رمز التحقق</button>
        </div>

        <div class="step" id="step-otp">
          <label>رمز التحقق (SMS)</label>
          <input type="text" id="otp-input" placeholder="أدخل الرمز" autocomplete="off" inputmode="numeric" />
          <button id="verify-btn">تحقق ودخول</button>
        </div>

        <div class="msg" id="msg"></div>
      </div>
    </div>
${landingFooterHtml()}
<script>
  const msg = document.getElementById('msg');
  const stepPhone = document.getElementById('step-phone');
  const stepOtp = document.getElementById('step-otp');
  const loginSection = document.getElementById('login-section');
  let currentPhone = '';

  // الوجهة الأصلية (مثلًا #/pay?trip=xxx) تُحفظ فور تحميل صفحة الدخول — قبل أي تفاعل مع OTP —
  // حتى نعيد المستخدم إلى نفس الرحلة/الصفحة بعد نجاح التحقق بدل الرئيسية دائمًا. المتصفح يُبقي
  // الـhash كما هو طوال هذه الصفحة (لا تنقّل حتى لحظة إعادة التوجيه بعد النجاح)، فقراءته هنا
  // تلتقط بالضبط الرابط الذي حاول المستخدم فتحه قبل أن يُحجب خلف شاشة الدخول.
  const returnHash = (location.hash && location.hash.startsWith('#/')) ? location.hash : '';

  function setMsg(text, type) {
    msg.textContent = text || '';
    msg.className = 'msg' + (type ? ' ' + type : '');
  }

  function revealLogin() {
    loginSection.classList.remove('hidden');
    loginSection.classList.add('in-view');
    loginSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('phone-input')?.focus({ preventScroll: true }), 450);
  }
  document.getElementById('hero-cta').addEventListener('click', revealLogin);
  document.getElementById('pitch-cta').addEventListener('click', revealLogin);

  document.getElementById('send-btn').addEventListener('click', async () => {
    const phone = document.getElementById('phone-input').value.trim();
    if (!phone) { setMsg('أدخل رقم الجوال', 'error'); return; }
    const btn = document.getElementById('send-btn');
    btn.disabled = true; setMsg('جارٍ الإرسال...', '');
    try {
      const res = await fetch('/api/send-otp', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ phone }) });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'تعذّر إرسال الرمز', 'error'); btn.disabled = false; return; }
      currentPhone = phone;
      stepPhone.classList.remove('active');
      stepOtp.classList.add('active');
      setMsg('تم إرسال الرمز إلى جوالك', 'success');
    } catch (e) {
      setMsg('تعذّر الاتصال بالخادم', 'error');
    }
    btn.disabled = false;
  });

  document.getElementById('verify-btn').addEventListener('click', async () => {
    const otp = document.getElementById('otp-input').value.trim();
    if (!otp) { setMsg('أدخل رمز التحقق', 'error'); return; }
    const btn = document.getElementById('verify-btn');
    btn.disabled = true; setMsg('جارٍ التحقق...', '');
    try {
      const res = await fetch('/api/verify-otp', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ phone: currentPhone, otp }) });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'رمز غير صحيح', 'error'); btn.disabled = false; return; }
      setMsg('تم التحقق بنجاح ✅', 'success');
      // نعود لنفس الوجهة (رحلة/صفحة) التي جاء منها المستخدم قبل تسجيل الدخول، وليس دائمًا للرئيسية —
      // الصفحة الوجهة نفسها (مثل pay.js أو trip.js) تتحقق من الملكية وحالة الدفع من السيرفر بشكل مستقل.
      // ملاحظة مهمة: عنوان هذه الصفحة (صفحة الدخول) يحمل أصلًا نفس الـhash المطلوب العودة إليه —
      // فتعيين location.href لعنوان يطابق العنوان الحالي حرفيًا يُعامَل من المتصفح كتنقّل داخل نفس
      // الجزء (fragment navigation) بلا إعادة تحميل فعلية للمستند (سلوك موحّد ومطابق للمواصفة عبر
      // المتصفحات)، فيبقى المستخدم عالقًا على HTML صفحة الدخول رغم امتلاكه جلسة صالحة الآن. لذا
      // نفرض تحميلًا فعليًا صريحًا عبر location.reload() في هذه الحالة (الحالة الشائعة)، ونستخدم
      // location.href فقط عندما تختلف الوجهة عمليًا عن العنوان الحالي.
      const dest = '/' + returnHash;
      if (dest === location.pathname + location.hash) {
        window.location.reload();
      } else {
        window.location.href = dest;
      }
    } catch (e) {
      setMsg('تعذّر الاتصال بالخادم', 'error');
      btn.disabled = false;
    }
  });

  ${LANDING_ANIMATE_SCRIPT}
</script>
</body>
</html>`;
}

// صفحة خطأ بسيطة بنفس هوية الموقع (بدل نص عادي أبيض/أسود) لحالات الفشل المتوقعة مثل
// تعذّر الاتصال بقاعدة البيانات — تبقى الرسالة عربية قصيرة داخل نفس تصميم BRAND_STYLE.
function errorPageHtml(message) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SmaTrips AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&display=swap" rel="stylesheet">
<style>${BRAND_STYLE}</style>
</head>
<body>
  <div class="box" style="text-align:center;">
    <h1>حدث خطأ غير متوقع</h1>
    <p class="sub">${message}</p>
    <button onclick="location.reload()">إعادة المحاولة</button>
  </div>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const isPublicAsset =
    path.startsWith('/api/') ||
    path.startsWith('/css/') ||
    path.startsWith('/js/') ||
    path.startsWith('/assets/') ||
    path === '/favicon.ico';

  if (isPublicAsset) {
    return next();
  }

  const token = readSessionCookie(request);
  const session = await verifySessionToken(token, env.SESSION_SECRET);

  // no-store على كل صفحات الدخول الديناميكية — تمنع أي متصفح أو طبقة وسيطة من
  // تخزين استجابة خاصة بجلسة (أو بغياب جلسة) وعرضها لاحقًا لمستخدم/جهاز آخر لم يمرّ بنفس التحقق.
  const noStoreHeaders = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };

  if (!session) {
    return new Response(loginHtml(), { status: 200, headers: noStoreHeaders });
  }

  // الدفع أصبح لكل رحلة (trip_id) وليس اشتراكًا عامًا يفتح الموقع كاملاً بعد تسجيل الدخول —
  // أي جلسة صالحة تدخل SPA مباشرة لتخطيط رحلاتها؛ صلاحية كل رحلة على حدة (trip_id + payment_status)
  // تُتحقّق داخل نقاط API الخاصة بالرحلات/الدفع (functions/_utils.js: isTripUnlocked)، وليس هنا.
  return next();
}
