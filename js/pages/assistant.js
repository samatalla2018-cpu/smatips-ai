// صفحة المساعد الذكي — واجهة محادثة سفر احترافية
// ملاحظة: هذه الواجهة فقط حاليًا. الربط بخدمة الذكاء الاصطناعي يتم لاحقًا من الخلفية
// (Server / Environment Variables) فلا يجب أن يظهر أي مفتاح API أو إعداد تقني هنا أبدًا.

const ASSISTANT_WELCOME = 'أهلاً بك! كيف أقدر أساعدك في رحلتك اليوم؟';

let assistantMessages = [];
let assistantBusy = false;

function chatBubbleHtml(msg) {
  const isUser = msg.role === 'user';
  return `<div class="chat-bubble ${isUser ? 'user' : 'assistant'}">${escapeHtml(msg.content)}</div>`;
}

function scrollChatToBottom() {
  const el = qs('#chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

function renderChatMessages() {
  const el = qs('#chat-messages');
  if (!el) return;
  el.innerHTML = assistantMessages.map(chatBubbleHtml).join('') + (assistantBusy ? `<div class="chat-bubble assistant flex items-center gap-2"><span class="spinner"></span><span>يفكّر...</span></div>` : '');
  scrollChatToBottom();
}

// نقطة الاتصال بمساعد الذكاء الاصطناعي الحقيقي — تُربط لاحقًا بواجهة خلفية آمنة (Cloudflare Pages Functions)
// تقرأ مفتاح الـ API من متغيرات البيئة على السيرفر، ولا تُرسل أو تُخزّن أي مفتاح في المتصفح
async function requestAssistantReply(messages) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return 'المساعد الذكي قيد التجهيز حاليًا وسيتم تفعيل الردود الذكية قريبًا. شكرًا لصبرك!';
}

async function sendChatMessage(text) {
  assistantMessages.push({ role: 'user', content: text });
  assistantBusy = true;
  renderChatMessages();

  try {
    const reply = await requestAssistantReply(assistantMessages);
    assistantMessages.push({ role: 'assistant', content: reply });
  } catch (err) {
    console.error(err);
    assistantMessages.push({ role: 'assistant', content: 'تعذّر الوصول إلى المساعد الذكي حاليًا. حاول مرة أخرى بعد قليل.', isError: true });
  }
  assistantBusy = false;
  renderChatMessages();
}

function renderAssistant(container) {
  assistantMessages = [{ role: 'assistant', content: ASSISTANT_WELCOME }];

  container.innerHTML = `
    ${pageHeader({
      title: 'مساعد السفر الذكي',
      desc: 'اسألني عن رحلتك، جدولك، الطقس، الأماكن أو أي تفاصيل تساعدك أثناء السفر.',
      iconName: 'sparkle',
    })}
    <div class="card" style="padding:12px; display:flex; flex-direction:column; height:65vh;">
      <div id="chat-messages" class="chat-messages"></div>
      <form id="chat-form" class="chat-input-row">
        <textarea id="chat-input" rows="1" placeholder="اكتب رسالتك هنا..." autocomplete="off"></textarea>
        <button type="submit" class="btn btn-primary" style="height:44px;" id="chat-send-btn" aria-label="إرسال">${icon('navigation', 17)}</button>
      </form>
    </div>
  `;

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
    sendChatMessage(text);
  });
}

registerRoute('/assistant', renderAssistant);
