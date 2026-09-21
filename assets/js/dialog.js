// Shared keyboard and focus behavior for the pickup dialogs.
window.SiteDialog = modal => {
  let opener;
  let previousOverflow = '';
  const focusable = () => [...modal.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')]
    .filter(node => !node.disabled && node.getClientRects().length && node.type !== 'hidden');
  const close = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = previousOverflow;
    if (opener?.isConnected) opener.focus();
  };
  modal.addEventListener('click', event => {
    if (event.target === modal || event.target.closest('[data-close], [data-modal-close]')) close();
  });
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const nodes = focusable();
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  return {
    close,
    open() {
      opener = document.activeElement;
      previousOverflow = document.body.style.overflow;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.style.overflow = 'hidden';
      (modal.querySelector('input:not([type="hidden"])') || focusable()[0])?.focus();
    }
  };
};
