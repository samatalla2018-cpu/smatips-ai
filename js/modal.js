// نظام نافذة منبثقة (Modal) عام تُستخدم في كل نماذج الإضافة والتعديل

function openModal(title, bodyHtml, onMount) {
  qs('#modal-title').textContent = title;
  qs('#modal-body').innerHTML = bodyHtml;
  qs('#modal-overlay').classList.add('open');
  // أي محتوى بداخل النافذة يحمل data-animate (مثل بطاقة الدفع) يجب تفعيله يدويًا هنا — لا يمر عبر
  // router.js الذي يستدعي initAnimate تلقائيًا بعد كل تنقّل صفحة، فيبقى بلا هذا النداء مخفيًا للأبد.
  if (window.initAnimate) initAnimate(qs('#modal-body'));
  if (onMount) onMount(qs('#modal-body'));
  const firstInput = qs('#modal-body input, #modal-body select, #modal-body textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeModal() {
  qs('#modal-overlay').classList.remove('open');
  qs('#modal-body').innerHTML = '';
}

function wireModal() {
  qs('#modal-close-btn').addEventListener('click', closeModal);
  qs('#modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
}

window.openModal = openModal;
window.closeModal = closeModal;
window.wireModal = wireModal;
