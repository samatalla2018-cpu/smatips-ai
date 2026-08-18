import { readSessionCookie, verifySessionToken, getSubscriptionStatus } from './_utils.js';

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

function loginHtml() {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>تسجيل الدخول — SmaTrips AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&display=swap" rel="stylesheet">
<style>${BRAND_STYLE}</style>
</head>
<body>
  <div class="box">
    <h1>SmaTrips AI</h1>
    <p class="sub">مساعد المسافر الذكي — دخول بجوالك</p>

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

<script>
  const msg = document.getElementById('msg');
  const stepPhone = document.getElementById('step-phone');
  const stepOtp = document.getElementById('step-otp');
  let currentPhone = '';

  function setMsg(text, type) {
    msg.textContent = text || '';
    msg.className = 'msg' + (type ? ' ' + type : '');
  }

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
      setMsg('تم الدخول، جارٍ التحويل...', 'success');
      window.location.href = '/';
    } catch (e) {
      setMsg('تعذّر الاتصال بالخادم', 'error');
      btn.disabled = false;
    }
  });
</script>
</body>
</html>`;
}

function paywallHtml(priceSar, isReturning) {
  const priceBlock = priceSar
    ? `<div class="price">${priceSar} <span>ريال — اشتراك مدى الحياة</span></div>`
    : `<p class="sub" style="margin-top:-8px;">اشتراك مدى الحياة بدفعة واحدة</p>`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>فعّل اشتراكك — SmaTrips AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&display=swap" rel="stylesheet">
<style>${BRAND_STYLE}</style>
</head>
<body>
  <div class="box">
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

<script>
  const msg = document.getElementById('msg');
  function setMsg(text, type) {
    msg.textContent = text || '';
    msg.className = 'msg' + (type ? ' ' + type : '');
  }

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
</script>
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

  if (!session) {
    return new Response(loginHtml(), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const status = await getSubscriptionStatus(env.DB, session.phone);
  if (status !== 'active') {
    const isReturning = url.searchParams.get('payment') === 'return';
    return new Response(paywallHtml(env.SUBSCRIPTION_PRICE_SAR, isReturning), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return next();
}
