// صفحة المساعد الذكي — محادثة حقيقية مع Claude عبر Anthropic API (يتطلب مفتاح API من المستخدم)

const AI_MODEL = 'claude-sonnet-5';
let assistantMessages = [];
let assistantBusy = false;

function buildSystemPrompt() {
  const trip = store.getTrip();
  const dest = [trip.city, trip.country].filter(Boolean).join('، ');
  const parts = ['أنت المساعد الذكي داخل تطبيق SmaTrips AI، مساعد سفر عربي. أجب بإيجاز ووضوح وبالعربية دائمًا ما لم يطلب المستخدم غير ذلك.'];
  if (dest) parts.push(`وجهة المستخدم الحالية: ${dest}.`);
  if (trip.startDate) parts.push(`تواريخ الرحلة: من ${trip.startDate} إلى ${trip.endDate || '—'}.`);
  if (trip.tripType) parts.push(`نوع الرحلة: ${trip.tripType}.`);
  if (trip.budget) parts.push(`الميزانية التقديرية: ${trip.budget} ${trip.currency || ''}.`);
  parts.push('ركّز إجاباتك على أسئلة السفر: الأماكن، الطقس، التكاليف، النصائح الثقافية، المستندات، وسائل التنقل، السلامة، وما شابه.');
  return parts.join(' ');
}

async function callClaude(apiKey, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

function chatBubbleHtml(msg) {
  const isUser = msg.role === 'user';
  return `
    <div class="chat-bubble ${isUser ? 'user' : 'assistant'}">${escapeHtml(msg.content)}</div>`;
}

function scrollChatToBottom() {
  const el = qs('#chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

function renderChatMessages() {
  const el = qs('#chat-messages');
  if (!el) return;
  if (!assistantMessages.length) {
    el.innerHTML = `
      <div class="empty-state" style="border:none; padding:30px 16px;">
        <div class="empty-state-icon">${icon('sparkle', 24)}</div>
        <h3>اسأل المساعد عن أي شيء يخص رحلتك</h3>
        <p>مثال: "ما هي أفضل الأماكن للزيارة في إسطنبول لمدة 3 أيام؟" أو "ماذا ألبس في لندن في هذا الموسم؟"</p>
      </div>`;
    return;
  }
  el.innerHTML = assistantMessages.map(chatBubbleHtml).join('') + (assistantBusy ? `<div class="chat-bubble assistant flex items-center gap-2"><span class="spinner"></span><span>يفكّر...</span></div>` : '');
  scrollChatToBottom();
}

async function sendChatMessage(container, text) {
  const settings = store.getSettings();
  assistantMessages.push({ role: 'user', content: text });
  assistantBusy = true;
  renderChatMessages();

  try {
    const reply = await callClaude(settings.aiApiKey, assistantMessages);
    assistantMessages.push({ role: 'assistant', content: reply || 'لم يصل رد نصي من المساعد.' });
  } catch (err) {
    console.error(err);
    let msg = 'تعذّر الوصول إلى المساعد الذكي. تأكد من اتصالك بالإنترنت وحاول مجددًا.';
    if (err.status === 401) msg = 'مفتاح API غير صحيح أو منتهي الصلاحية. تحقق منه من صفحة الإعدادات أعلاه.';
    else if (err.status === 429) msg = 'تم تجاوز الحد المسموح من الطلبات لهذا المفتاح مؤقتًا. حاول بعد قليل.';
    else if (err.message) msg = `تعذّر الحصول على رد: ${err.message}`;
    assistantMessages.push({ role: 'assistant', content: msg, isError: true });
  }
  assistantBusy = false;
  renderChatMessages();
}

function apiKeySetupHtml() {
  return `
    <div class="card">
      <div class="flex items-center gap-2" style="margin-bottom:10px;">
        <div class="page-header-icon" style="width:36px;height:36px;border-radius:11px;">${icon('sparkle', 18)}</div>
        <div class="font-bold">فعّل المساعد الذكي</div>
      </div>
      <p class="text-sm text-muted">يعمل المساعد عبر Anthropic Claude API، ويحتاج مفتاح API خاصًا بك لتفعيله فعليًا (وليس بيانات وهمية). المفتاح يُحفظ في متصفحك فقط ولا يُرسل إلا مباشرة إلى Anthropic.</p>
      <form id="api-key-form" class="flex-col gap-2 mt-3">
        <div class="field">
          <label>مفتاح Anthropic API</label>
          <input type="password" name="apiKey" placeholder="sk-ant-..." autocomplete="off" required />
        </div>
        <button type="submit" class="btn btn-primary">${icon('check', 16)}<span>حفظ وتفعيل</span></button>
      </form>
      <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" class="text-sm mt-2" style="display:inline-block; color:var(--primary); font-weight:700;">${icon('external', 13)} احصل على مفتاح من console.anthropic.com</a>
    </div>`;
}

function renderAssistant(container) {
  const settings = store.getSettings();
  const hasKey = !!settings.aiApiKey;
  assistantMessages = [];

  container.innerHTML = `
    ${pageHeader({
      title: 'المساعد الذكي',
      desc: 'اسأل عن أي شيء يخص رحلتك — أماكن، طقس، نصائح، تكاليف',
      iconName: 'sparkle',
      actions: hasKey ? `<button class="btn btn-outline btn-sm" id="change-key-btn">${icon('edit', 15)}<span>تغيير المفتاح</span></button>` : '',
    })}
    ${hasKey ? `
      <div class="card" style="padding:12px; display:flex; flex-direction:column; height:65vh;">
        <div id="chat-messages" class="chat-messages"></div>
        <form id="chat-form" class="chat-input-row">
          <textarea id="chat-input" rows="1" placeholder="اكتب سؤالك هنا..." autocomplete="off"></textarea>
          <button type="submit" class="btn btn-primary" style="height:44px;" id="chat-send-btn">${icon('navigation', 17)}</button>
        </form>
      </div>
    ` : apiKeySetupHtml()}
  `;

  if (hasKey) {
    renderChatMessages();
    const form = qs('#chat-form');
    const input = qs('#chat-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || assistantBusy) return;
      input.value = '';
      sendChatMessage(container, text);
    });
    qs('#change-key-btn').addEventListener('click', () => {
      if (confirm('سيتم مسح المفتاح الحالي. هل تريد المتابعة؟')) {
        store.updateSettings({ aiApiKey: '' });
        renderAssistant(container);
      }
    });
  } else {
    qs('#api-key-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const key = fd.get('apiKey').trim();
      if (!key) return;
      store.updateSettings({ aiApiKey: key });
      toast('تم حفظ المفتاح — المساعد جاهز الآن', 'success');
      renderAssistant(container);
    });
  }
}

registerRoute('/assistant', renderAssistant);
