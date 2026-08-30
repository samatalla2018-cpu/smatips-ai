import { readSessionCookie, verifySessionToken, getSubscriptionStatus, normalizePhone } from './_utils.js';

const BRAND_STYLE = `
  :root{--bg:#F7F3FF;--surface:#FFFFFF;--border:#E3D8F7;--text:#1E1A33;--text-muted:#6D6488;--primary:#8B5CF6;--primary-dark:#7C3AED;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Cairo',sans-serif;background:radial-gradient(circle at 20% 0%, rgba(139,92,246,.10), transparent 55%), var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
  .box{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px 24px;max-width:400px;width:100%;box-shadow:0 16px 40px rgba(16,24,40,.12);}
  h1{font-size:19px;margin:0 0 6px;text-align:center;}
  p.sub{font-size:13px;color:var(--text-muted);text-align:center;margin:0 0 20px;}
  label{font-size:13px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px;}
  input{width:100%;height:46px;border-radius:12px;border:1px solid var(--border);padding:0 14px;font-size:15px;font-family:inherit;margin-bottom:14px;outline:none;}
  input:focus{border-color:var(--primary);}
  button{width:100%;height:46px;border-radius:12px;border:none;background:var(--primary);color:#fff;font-weight:800;font-size:14.5px;cursor:pointer;}
  button:hover{filter:brightness(1.06);}
  button:disabled{opacity:.6;cursor:not-allowed;}
  button.ghost{background:transparent;color:var(--text-muted);font-weight:700;margin-top:10px;}
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
  :root{--accent:#D9A441;--accent-light:#FAF0DA;--sky:#22C7E8;--sky-light:#E1F7FB;--primary-light:#EDE4FF;}
  body{display:block;padding:0;align-items:initial;justify-content:initial;background:
    radial-gradient(circle at 12% 0%, rgba(139,92,246,.09), transparent 45%),
    radial-gradient(circle at 100% 15%, rgba(34,199,232,.08), transparent 40%),
    #FFFFFF;}
  .lp{max-width:1180px;margin:0 auto;padding:0 18px;}

  .lp-header{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:10px;padding:16px 18px;max-width:1180px;margin:0 auto;background:rgba(255,255,255,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}
  .lp-header img{height:36px;width:36px;border-radius:10px;}
  .lp-header .lp-brand-title{font-size:16px;font-weight:800;}
  .lp-header .lp-brand-sub{font-size:11.5px;color:var(--text-muted);font-weight:600;}

  .lp-eyebrow{display:inline-flex;align-items:center;gap:6px;padding:7px 15px;border-radius:999px;background:var(--primary-light);color:var(--primary-dark);font-size:12px;font-weight:800;margin-bottom:16px;}

  .lp-hero{padding:30px 4px 26px;}
  .lp-hero-inner{display:flex;flex-direction:column;align-items:center;}
  .lp-hero-text{text-align:center;}
  .lp-hero h1{font-size:27px;line-height:1.35;font-weight:900;margin:0 0 14px;background:linear-gradient(90deg,var(--primary-dark),var(--primary));-webkit-background-clip:text;background-clip:text;color:transparent;}
  .lp-hero p{font-size:14.5px;color:var(--text-muted);max-width:560px;margin:0 auto 22px;line-height:1.85;}
  .lp-hero-visual{display:none;}
  .lp-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:52px;padding:0 30px;border:none;border-radius:15px;background:linear-gradient(90deg,var(--primary),var(--primary-dark));color:#fff;font-weight:800;font-size:15.5px;cursor:pointer;box-shadow:0 10px 26px rgba(139,92,246,.28);transition:transform .15s ease, box-shadow .15s ease;}
  .lp-cta:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(139,92,246,.36);}
  .lp-cta:active{transform:translateY(0);}
  .lp-cta .gold-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);}

  .lp-cards{display:grid;grid-template-columns:1fr;gap:12px;padding:8px 4px 36px;}
  .lp-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:20px 18px;text-align:center;font-weight:700;font-size:14px;box-shadow:0 4px 16px rgba(16,24,40,.05);transition:transform .18s ease, box-shadow .18s ease;}
  .lp-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(16,24,40,.09);}

  .lp-section-title{text-align:center;font-size:21px;font-weight:900;margin:0 0 22px;}
  .lp-features{padding:10px 4px 38px;}
  .lp-feat-grid{display:grid;grid-template-columns:1fr;gap:12px;}
  .lp-feat{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:18px 14px;text-align:center;box-shadow:0 4px 14px rgba(16,24,40,.05);transition:transform .18s ease, box-shadow .18s ease;}
  .lp-feat:hover{transform:translateY(-3px);box-shadow:0 12px 26px rgba(16,24,40,.09);}
  .lp-feat .icon-wrap{width:44px;height:44px;border-radius:13px;background:var(--primary-light);color:var(--primary-dark);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;}
  .lp-feat:nth-child(2n) .icon-wrap{background:var(--sky-light);color:#0E8FA8;}
  .lp-feat:nth-child(4n) .icon-wrap{background:var(--accent-light);color:#A6791F;}
  .lp-feat span{font-size:12.5px;font-weight:700;line-height:1.5;display:block;}

  .lp-pitch{text-align:center;padding:14px 4px 40px;}
  .lp-pitch p{font-size:17px;font-weight:800;max-width:520px;margin:0 auto 22px;line-height:1.7;}
  .lp-pitch .gold-rule{width:52px;height:3px;border-radius:3px;background:var(--accent);margin:0 auto 18px;}

  .lp-login-wrap{padding:6px 4px 50px;display:flex;justify-content:center;}
  .lp-login-wrap.hidden{display:none;}
  .lp-login-card.box{max-width:420px;border-radius:24px;padding:34px 26px;box-shadow:0 20px 48px rgba(16,24,40,.13);}
  .lp-login-icon{width:50px;height:50px;border-radius:15px;background:var(--primary-light);color:var(--primary-dark);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;}

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
    .lp-hero{padding:46px 4px 36px;}
    .lp-hero h1{font-size:33px;}
    .lp-hero p{font-size:15.5px;}
    .lp-cards{grid-template-columns:repeat(3,1fr);gap:16px;}
    .lp-feat-grid{grid-template-columns:repeat(2,1fr);gap:14px;}
    .lp-pitch p{font-size:19px;}
  }

  /* ===== كمبيوتر مكتبي: استغلال أوسع للعرض، Hero بعمودين ===== */
  @media (min-width:1024px){
    .lp{padding:0 40px;}
    .lp-header{padding:22px 40px;}
    .lp-header img{height:42px;width:42px;}
    .lp-header .lp-brand-title{font-size:18px;}
    .lp-header .lp-brand-sub{font-size:12.5px;}

    .lp-hero{padding:64px 4px 56px;}
    .lp-hero-inner{flex-direction:row;align-items:center;justify-content:space-between;gap:64px;}
    .lp-hero-text{text-align:right;flex:1 1 50%;}
    .lp-hero-text .lp-eyebrow{margin-inline:0;}
    .lp-hero h1{font-size:46px;line-height:1.28;}
    .lp-hero p{font-size:16.5px;max-width:480px;margin:0 0 28px;}
    .lp-hero-visual{display:block;position:relative;flex:1 1 44%;height:380px;}
    .lp-hero-blob{position:absolute;inset:0;border-radius:32px;background:linear-gradient(135deg,var(--primary-light),var(--sky-light) 75%);box-shadow:0 24px 56px rgba(139,92,246,.16);}
    .lp-hero-blob::after{content:'';position:absolute;inset:0;border-radius:32px;background:radial-gradient(circle at 85% 12%, rgba(217,164,65,.22), transparent 45%);}
    .lp-chip{position:absolute;display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:11px 16px;font-size:13px;font-weight:800;box-shadow:0 12px 26px rgba(16,24,40,.1);color:var(--text);}
    .lp-chip-1{top:10%;right:6%;color:var(--primary-dark);}
    .lp-chip-2{top:46%;right:50%;color:#0E8FA8;}
    .lp-chip-3{bottom:8%;right:16%;color:#A6791F;}

    .lp-cards{gap:20px;padding:28px 4px 64px;}
    .lp-card{padding:26px 22px;font-size:15px;border-radius:20px;}

    .lp-features{padding:22px 4px 68px;}
    .lp-section-title{font-size:27px;margin-bottom:34px;}
    .lp-feat-grid{grid-template-columns:repeat(3,1fr);gap:18px;}
    .lp-feat{padding:24px 18px;border-radius:20px;}
    .lp-feat .icon-wrap{width:50px;height:50px;border-radius:14px;}
    .lp-feat span{font-size:13.5px;}

    .lp-pitch{padding:22px 4px 64px;}
    .lp-pitch p{font-size:22px;max-width:620px;}

    .lp-login-wrap{padding:12px 4px 72px;}
  }
`;

// الأقسام التسويقية المشتركة لصفحة الهبوط (Hero + البطاقات + المزايا + الدعوة للعمل) —
// تُستخدم دون أي تعديل في كل من صفحة تسجيل الدخول وصفحة الاشتراك بعد التحقق، حتى لا يفقد
// المستخدم سياق المنتج (المزايا والتسعير) في أي مرحلة من رحلته قبل الدفع.
function landingMarketingHtml() {
  return `
  <header class="lp-header">
    <img src="/assets/logo/logo-mark.png" alt="SmaTrips AI" />
    <div>
      <div class="lp-brand-title">SmaTrips AI</div>
      <div class="lp-brand-sub">مساعد المسافر الذكي</div>
    </div>
  </header>

  <div class="lp">
    <section class="lp-hero" data-animate>
      <div class="lp-hero-inner">
        <div class="lp-hero-text">
          <span class="lp-eyebrow">${lpIcon('sparkle', 15)}مساعد سفرك الذكي</span>
          <h1>رتّب سفرتك كلها في مكان واحد</h1>
          <p>خطتك اليومية، مهامك، أغراض السفر، الطقس، العملات، المقابس والروابط المهمة… بدون تشتت بين الملاحظات والتطبيقات.</p>
          <button class="lp-cta" id="hero-cta" type="button"><span class="gold-dot"></span>ابدأ التخطيط الآن</button>
        </div>
        <div class="lp-hero-visual" aria-hidden="true">
          <div class="lp-hero-blob"></div>
          <div class="lp-chip lp-chip-1">${lpIcon('calendar', 17)}<span>الجدول اليومي</span></div>
          <div class="lp-chip lp-chip-2">${lpIcon('cloud', 17)}<span>الطقس</span></div>
          <div class="lp-chip lp-chip-3">${lpIcon('bag', 17)}<span>أغراض السفر</span></div>
        </div>
      </div>
    </section>

    <section class="lp-cards" data-animate>
      <div class="lp-card">كل تفاصيل رحلتك في مكان واحد</div>
      <div class="lp-card">خطتك محفوظة وتفتحها من أي جهاز</div>
      <div class="lp-card">مساعد ذكي قبل السفر وأثناء الرحلة</div>
    </section>

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
<meta name="theme-color" content="#8B5CF6" />
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
      window.location.href = '/';
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

// تُعرض للمستخدم بعد تسجيل الدخول (نجاح التحقق OTP) طالما اشتراكه غير فعّال بعد — نفس صفحة
// الهبوط الكاملة (Hero + المزايا + التسعير) بدل بطاقة اشتراك مجرّدة، حتى يستعرض المستخدم
// المنتج والسعر قبل الضغط على "اشترك الآن"، وعندها فقط يبدأ الدفع عبر Moyasar.
function subscribeLandingHtml(priceSar, isReturning) {
  const priceBlock = priceSar
    ? `<div class="price">${priceSar} <span>ريال — اشتراك مدى الحياة</span></div>`
    : `<p class="sub" style="margin-top:-8px;">اشتراك مدى الحياة بدفعة واحدة</p>`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>فعّل اشتراكك — SmaTrips AI</title>
<meta name="description" content="رتّب سفرتك كلها في مكان واحد: خطتك اليومية، مهامك، أغراض السفر، الطقس، العملات، والمزيد." />
<meta name="theme-color" content="#8B5CF6" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<style>${BRAND_STYLE}${LANDING_STYLE}</style>
</head>
<body>
${landingMarketingHtml()}
    <div class="lp-login-wrap${isReturning ? '' : ' hidden'}" id="subscribe-section" data-animate>
      <div class="box lp-login-card">
        <div class="lp-login-icon">${lpIcon('check', 22)}</div>
        <div class="step ${isReturning ? '' : 'active'}" id="step-subscribe">
          <h1>فعّل اشتراكك في SmaTrips AI</h1>
          <p class="sub">اشتراك واحد يفتح لك كل أدوات تخطيط رحلتك مدى الحياة</p>
          ${priceBlock}
          <button id="subscribe-btn" style="margin-top:14px;">اشترك الآن</button>
          <button class="ghost" id="logout-btn">تسجيل خروج</button>
          <div class="msg" id="msg"></div>
        </div>

        <div class="step ${isReturning ? 'active' : ''}" id="step-verifying">
          <h1>جارٍ التحقق من الدفع</h1>
          <div class="spinner"></div>
          <p class="sub">قد يستغرق هذا بضع ثوانٍ، لا تُغلق الصفحة...</p>
        </div>
      </div>
    </div>
${landingFooterHtml()}
<script>
  const msg = document.getElementById('msg');
  const subscribeSection = document.getElementById('subscribe-section');

  function setMsg(text, type) {
    msg.textContent = text || '';
    msg.className = 'msg' + (type ? ' ' + type : '');
  }

  function revealSubscribe() {
    subscribeSection.classList.remove('hidden');
    subscribeSection.classList.add('in-view');
    subscribeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.getElementById('hero-cta').addEventListener('click', revealSubscribe);
  document.getElementById('pitch-cta').addEventListener('click', revealSubscribe);

  document.getElementById('subscribe-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('subscribe-btn');
    btn.disabled = true; setMsg('جارٍ التحويل لصفحة الدفع...', '');
    try {
      const res = await fetch('/api/payment/create', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) { setMsg(data.error || 'تعذّر بدء عملية الدفع', 'error'); btn.disabled = false; return; }
      window.location.href = data.url;
    } catch (e) {
      setMsg('تعذّر الاتصال بالخادم', 'error');
      btn.disabled = false;
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.reload();
  });

  ${isReturning ? `
  (function poll() {
    fetch('/api/subscription/status').then((r) => r.json()).then((data) => {
      if (data.status === 'active') { window.location.reload(); return; }
      setTimeout(poll, 2000);
    }).catch(() => setTimeout(poll, 3000));
  })();
  ` : ''}

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

  // no-store على كل صفحات الدخول/الاشتراك الديناميكية — تمنع أي متصفح أو طبقة وسيطة من
  // تخزين استجابة خاصة بجلسة (أو بغياب جلسة) وعرضها لاحقًا لمستخدم/جهاز آخر لم يمرّ بنفس التحقق.
  const noStoreHeaders = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };

  if (!session) {
    return new Response(loginHtml(), { status: 200, headers: noStoreHeaders });
  }

  // المالك (ALLOWED_PHONE) يتجاوز الدفع ويصل مباشرة — أي عميل آخر يجب أن يشترك فعليًا
  const isOwner = env.ALLOWED_PHONE && session.phone === normalizePhone(env.ALLOWED_PHONE);
  if (isOwner) {
    return next();
  }

  // فشل الاتصال بقاعدة البيانات هنا يجب ألا يمنح وصولاً مجانيًا — نرجع خطأ صريح بدل next().
  let status;
  try {
    status = await getSubscriptionStatus(env.DB, session.phone);
  } catch {
    return new Response(
      errorPageHtml('تعذّر التحقق من حالة الاشتراك، حاول مرة أخرى بعد قليل.'),
      { status: 503, headers: noStoreHeaders }
    );
  }

  if (status !== 'active') {
    const isReturning = url.searchParams.get('payment') === 'return';
    return new Response(subscribeLandingHtml(env.SUBSCRIPTION_PRICE_SAR, isReturning), { status: 200, headers: noStoreHeaders });
  }

  return next();
}
