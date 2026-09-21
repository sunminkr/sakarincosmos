(() => {
  let selectedItem;
  let submitting = false;
  let closeTimer;
  const fieldClass = 'w-full bg-surface-container-lowest border border-outline-variant/50 px-3 py-2.5 text-on-surface font-body-md text-body-md focus:border-primary focus:outline-none';
  const modal = document.createElement('div');
  modal.id = 'pickup-application-modal';
  modal.className = 'fixed inset-0 z-[80] hidden items-center justify-center bg-surface-container-lowest/85 backdrop-blur-sm p-4';
  modal.innerHTML = `
    <section class="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-surface border border-outline-variant/40" role="dialog" aria-modal="true" aria-labelledby="pickup-modal-title">
      <div class="sticky top-0 bg-surface-container-lowest px-5 md:px-7 py-4 border-b border-outline-variant/30 flex items-center justify-between z-10">
        <div><div class="font-label-micro text-label-micro text-primary tracking-widest">PICKUP REGISTER / SECURE DISPATCH</div><h2 id="pickup-modal-title" class="font-headline-md text-headline-md mt-1">현장 픽업 신청 정보</h2></div>
        <button type="button" data-modal-close class="p-2 text-outline hover:text-on-surface" aria-label="신청 창 닫기"><span class="material-symbols-outlined">close</span></button>
      </div>
      <form id="pickup-application-form" class="p-5 md:p-7 space-y-5">
        <div class="bg-surface-container-low p-4 border-l-2 border-primary">
          <div class="font-label-micro text-label-micro text-outline">SELECTED OBJECT</div>
          <div id="pickup-selected-item" class="font-headline-sm text-headline-sm mt-1"></div>
          <div id="pickup-selected-venue" class="font-label-code text-label-code text-primary mt-2"></div>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <label class="block"><span class="block font-label-code text-label-code text-outline mb-2">성함 / NAME *</span><input class="${fieldClass}" name="name" autocomplete="name" required maxlength="60"></label>
          <label class="block"><span class="block font-label-code text-label-code text-outline mb-2">연락처 / PHONE *</span><input class="${fieldClass}" name="phone" type="tel" autocomplete="tel" required maxlength="30" placeholder="010-0000-0000"></label>
        </div>
        <label class="block"><span class="block font-label-code text-label-code text-outline mb-2">이메일 / EMAIL *</span><input class="${fieldClass}" name="email" type="email" autocomplete="email" required maxlength="120" placeholder="name@example.com"></label>
        <div class="grid md:grid-cols-2 gap-4">
          <label class="block"><span class="block font-label-code text-label-code text-outline mb-2">수량 / QTY *</span><select class="${fieldClass}" name="quantity" required><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>
          <label class="block"><span class="block font-label-code text-label-code text-outline mb-2">사이즈 / OPTION</span><select class="${fieldClass}" name="option"><option value="">해당 없음</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option></select></label>
        </div>
        <label class="block"><span class="block font-label-code text-label-code text-outline mb-2">요청 사항 / NOTE</span><textarea class="${fieldClass} resize-y min-h-24" name="note" maxlength="500" placeholder="픽업 또는 상품에 관해 남길 내용"></textarea></label>
        <label class="flex items-start gap-3 text-body-sm text-on-surface-variant leading-5"><input class="mt-1 accent-primary" name="privacy" type="checkbox" required><span>픽업 진행을 위해 성함, 연락처, 이메일을 수집하고 공연 종료 후 30일 이내 파기하는 데 동의합니다. *</span></label>
        <input type="text" name="website" class="hidden" tabindex="-1" autocomplete="off" aria-hidden="true">
        <input type="hidden" name="showId">
        <div id="pickup-form-status" class="hidden p-3 font-label-code text-label-code" role="status" aria-live="polite"></div>
        <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
          <button type="button" data-modal-close class="px-5 py-3 bg-surface-container text-outline font-label-code text-label-code tracking-widest">CANCEL</button>
          <button type="submit" class="px-5 py-3 bg-primary text-on-primary font-label-code text-label-code tracking-widest hover:bg-primary-fixed disabled:opacity-50">SEND PICKUP REQUEST →</button>
        </div>
      </form>
    </section>`;

  document.body.appendChild(modal);
  const dialog = SiteDialog(modal);
  const form = modal.querySelector('form');
  const status = form.querySelector('#pickup-form-status');
  const submit = form.querySelector('[type="submit"]');
  const showStatus = (message, error = false) => {
    status.className = `p-3 text-sm ${error ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface'}`;
    status.textContent = message;
  };
  window.addEventListener('pickupselect', event => { selectedItem = { ...event.detail }; });
  function checkShow() {
    const open = SiteCatalog.canPickup(SiteCatalog.show(form.elements.showId.value));
    if (!open && !modal.classList.contains('hidden')) {
      showStatus('선택한 공연의 픽업이 마감되었습니다. 창을 닫고 다른 공연을 선택해 주세요.', true);
      submit.disabled = true;
    }
    return open;
  }
  document.getElementById('tray-submit').addEventListener('click', () => {
    if (!selectedItem || submitting) return;
    const show = SiteCatalog.show(document.querySelector('input[name="pickup_show"]:checked')?.value);
    if (!SiteCatalog.canPickup(show)) {
      window.dispatchEvent(new Event('schedulechange'));
      return;
    }
    clearTimeout(closeTimer);
    const product = SiteCatalog.product(selectedItem.productId);
    form.reset();
    form.elements.quantity.innerHTML = Array.from({ length: 9 }, (_, i) => `<option>${i + 1}</option>`).join('');
    form.elements.option.innerHTML = product.sizes.length
      ? product.sizes.map(size => `<option value="${size}">${size}</option>`).join('')
      : '<option value="">해당 없음</option>';
    form.elements.option.value = selectedItem.size;
    form.elements.option.required = Boolean(product.sizes.length);
    form.elements.option.closest('label').hidden = !product.sizes.length;
    form.elements.showId.value = show.id;
    modal.querySelector('#pickup-selected-item').textContent = `${product.name} · ${SiteI18n.currency(product.price)}`;
    modal.querySelector('#pickup-selected-venue').textContent = SiteCatalog.showLabel(show);
    status.className = 'hidden';
    submit.disabled = false;
    document.getElementById('reservation-tray').classList.add('translate-y-full');
    dialog.open();
  });
  window.addEventListener('schedulechange', checkShow);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !selectedItem || !checkShow()) return;
    const fields = Object.fromEntries(new FormData(form));
    const item = { productId: selectedItem.productId, size: fields.option || '', quantity: Number(fields.quantity) };
    if (!SiteCatalog.optionsValid(item) || !form.reportValidity()) return;
    submitting = true;
    submit.disabled = true;
    showStatus('픽업 신청을 전송하고 있습니다.');
    let success = false;
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, items: [item] })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || '전송에 실패했습니다. 다시 시도해 주세요.');
      success = true;
      SiteCart.removeSubmitted([item]);
      showStatus('신청이 접수되어 담당자에게 발송되었습니다.');
      closeTimer = setTimeout(dialog.close, 1800);
    } catch (error) {
      showStatus(error.message === 'Failed to fetch' ? '메일 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' : error.message, true);
    } finally {
      submitting = false;
      submit.disabled = success || !SiteCatalog.canPickup(SiteCatalog.show(fields.showId));
    }
  });
})();
