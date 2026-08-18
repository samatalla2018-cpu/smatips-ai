import { readSessionCookie, verifySessionToken } from './_utils.js';

const LOGIN_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>تسجيل الدخول — SmaTrips AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  :root{--bg:#F7F3FF;--surface:#FFFFFF;--border:#E3D8F7;--text:#1E1A33;--text-muted:#6D6488;--primary:#8B5CF6;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Cairo',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
  .box{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px 24px;max-width:380px;width:100%;box-shadow:0 16px 40px rgba(16,24,40,.12);}
  h1{font-size:19px;margin:0 0 6px;text-align:center;}
  p.sub{font-size:13px;color:var(--text-muted);text-align:center;margin:0 0 20px;}
  label{font-size:13px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:6px;}
  input{width:100%;height:46px;border-radius:12px;border:1px solid var(--border);padding:0 14px;font-size:15px;font-family:inherit;margin-bottom:14px;outline:none;}
  input:focus{border-color:var(--primary);}
  button{width:100%;height:46px;border-radius:12px;border:none;background:var(--primary);color:#fff;font-weight:800;font-size:14.5px;cursor:pointer;}
  button:disabled{opacity:.6;cursor:not-allowed;}
  .msg{font-size:13px;text-align:center;margin-top:12px;min-height:18px;}
  .msg.error{color:#E11D48;}
  .msg.success{color:#16A34A;}
  .step{display:none;}
  .step.active{display:block;}
</style>
</head>
<body>
  <div class="box">
    <h1>SmaTrips AI</h1>
    <p class="sub">مساعد المسافر الذكي — دخول محمي</p>

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
  const valid = await verifySessionToken(token, env.SESSION_SECRET);
  if (valid) {
    return next();
  }

  return new Response(LOGIN_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
