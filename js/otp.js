// خطوة تسجيل الدخول (OTP) داخل الـSPA نفسها — تُستدعى فقط عند لحظة الحاجة الحقيقية (مثل إكمال
// إنشاء رحلة بعد المعاينة المجانية)، بدل الانتقال لصفحة منفصلة. تستخدم بالضبط نفس نقطتَي الـAPI
// الموجودتَين (send-otp / verify-otp) بنفس العقد تمامًا — لا تغيير على أي منهما ولا على طريقة
// إنشاء/التحقق من الجلسة (createSessionToken/verifySessionToken)، فقط مكان استدعائهما في الواجهة.
// بما أن هذا نافذة داخل نفس الصفحة (بلا أي إعادة تحميل)، بيانات الرحلة المحلية لا تُلمَس إطلاقًا.

function otpModalBodyHtml() {
  return `
    <div class="flex-col gap-3">
      <p class="text-sm text-muted">لإكمال رحلتك وفتحها، سجّل دخولك برقم جوالك — رمز تحقق قصير عبر SMS، بدون كلمة مرور.</p>
      <div class="field" id="otp-phone-step">
        <label>رقم الجوال</label>
        <input type="tel" id="otp-phone-input" placeholder="9665XXXXXXXX" autocomplete="off" inputmode="tel" />
        <div class="text-sm text-muted" style="margin-top:6px;">باستخدامك رقم جوالك، أنت توافق على <a href="#/privacy" target="_blank" rel="noopener noreferrer" style="color:var(--primary-dark);font-weight:700;">سياسة الخصوصية</a></div>
      </div>
      <div class="field" id="otp-code-step" hidden>
        <label>رمز التحقق (SMS)</label>
        <input type="text" id="otp-code-input" placeholder="أدخل الرمز" autocomplete="off" inputmode="numeric" />
      </div>
      <button type="button" class="btn btn-primary btn-block" id="otp-action-btn">${icon('phone', 16)}<span>إرسال رمز التحقق</span></button>
      <button type="button" class="btn btn-outline btn-block" id="otp-resend-btn" hidden>إعادة إرسال الرمز</button>
    </div>`;
}

// onVerified(): تُستدعى فور نجاح التحقق (الجلسة أصبحت فعّالة فعليًا عبر Set-Cookie من السيرفر) —
// لا حاجة لإعادة تحميل الصفحة إطلاقًا؛ أي طلب fetch لاحق بنفس المتصفح سيحمل الجلسة الجديدة تلقائيًا.
function openOtpModal({ onVerified }) {
  let phase = 'phone';
  let currentPhone = '';

  openModal('تسجيل الدخول', otpModalBodyHtml(), () => {
    const phoneStep = qs('#otp-phone-step');
    const codeStep = qs('#otp-code-step');
    const phoneInput = qs('#otp-phone-input');
    const codeInput = qs('#otp-code-input');
    const actionBtn = qs('#otp-action-btn');
    const resendBtn = qs('#otp-resend-btn');

    async function sendCode() {
      const phone = phoneInput.value.trim();
      if (!phone) { toast('أدخل رقم الجوال', 'error'); return; }
      actionBtn.disabled = true; actionBtn.innerHTML = `<span class="spinner"></span><span>جارٍ الإرسال...</span>`;
      try {
        const res = await fetch('/api/send-otp', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast(data.error || 'تعذّر إرسال رمز التحقق', 'error');
          actionBtn.disabled = false; actionBtn.innerHTML = `${icon('phone', 16)}<span>إرسال رمز التحقق</span>`;
          return;
        }
        currentPhone = phone;
        phase = 'otp';
        phoneStep.hidden = true;
        codeStep.hidden = false;
        resendBtn.hidden = false;
        actionBtn.innerHTML = `${icon('check', 16)}<span>تحقق ودخول</span>`;
        actionBtn.disabled = false;
        toast('تم إرسال الرمز إلى جوالك', 'success');
        setTimeout(() => codeInput.focus(), 50);
      } catch {
        toast('تعذّر الاتصال بالخادم', 'error');
        actionBtn.disabled = false; actionBtn.innerHTML = `${icon('phone', 16)}<span>إرسال رمز التحقق</span>`;
      }
    }

    async function verifyCode() {
      const otp = codeInput.value.trim();
      if (!otp) { toast('أدخل رمز التحقق', 'error'); return; }
      actionBtn.disabled = true; actionBtn.innerHTML = `<span class="spinner"></span><span>جارٍ التحقق...</span>`;
      try {
        const res = await fetch('/api/verify-otp', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: currentPhone, otp }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast(data.error || 'رمز غير صحيح', 'error');
          actionBtn.disabled = false; actionBtn.innerHTML = `${icon('check', 16)}<span>تحقق ودخول</span>`;
          return;
        }
        toast('تم التحقق بنجاح ✅', 'success');
        closeModal();
        onVerified();
      } catch {
        toast('تعذّر الاتصال بالخادم', 'error');
        actionBtn.disabled = false; actionBtn.innerHTML = `${icon('check', 16)}<span>تحقق ودخول</span>`;
      }
    }

    actionBtn.addEventListener('click', () => { phase === 'phone' ? sendCode() : verifyCode(); });
    resendBtn.addEventListener('click', sendCode);
    phoneInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendCode(); } });
    codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); verifyCode(); } });
  });
}

window.openOtpModal = openOtpModal;
