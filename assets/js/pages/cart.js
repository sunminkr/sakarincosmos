(async () => {
  const itemsBox = document.getElementById('cart-items');
  const empty = document.getElementById('empty-cart');
  const notice = document.getElementById('cart-notice');
  const openButton = document.getElementById('open-order');
  const modal = document.getElementById('order-modal');
  const form = document.getElementById('order-form');
  const status = document.getElementById('order-status');
  const submit = form.querySelector('[type="submit"]');
  const dialog = SiteDialog(modal);
  const escape = SiteCatalog.escape;
  let submitting = false, closeTimer;
  await SiteCart.ready;

  function render() {
    const items = SiteCart.read();
    const selected = document.activeElement;
    const focusIndex = selected?.dataset.index;
    const focusAction = selected?.dataset.action;
    itemsBox.innerHTML = items.map((item, index) => {
      const product = SiteCatalog.product(item.productId);
      return `<article class="cart-item">
        <div class="cart-item-description"><div class="font-mono text-[9px] text-primary">OBJECT ${String(index + 1).padStart(2, '0')}</div>
          <h3>${escape(item.name)}</h3><p>${escape(item.price)}</p>
          ${product.sizes.length ? `<label class="product-size-label">${SiteI18n.t('size.label')}<select class="cart-size" data-action="size" data-index="${index}" aria-label="${escape(item.name)} ${SiteI18n.t('size.label')}" required><option value="">${SiteI18n.t('size.required')}</option>${product.sizes.map(size => `<option value="${size}"${item.size === size ? ' selected' : ''}>${size}</option>`).join('')}</select></label>
          <button type="button" class="add-size" data-index="${index}" data-action="add-size">${SiteI18n.t('size.add')}</button>` : `<p class="cart-option-note">${SiteI18n.t('size.none')}</p>`}
        </div>
        <div class="cart-quantity"><button type="button" class="qty" data-action="decrease" data-index="${index}" data-delta="-1" aria-label="${escape(item.name)} ${SiteI18n.t('cart.decrease')}">−</button><span>${item.quantity}</span><button type="button" class="qty" data-action="increase" data-index="${index}" data-delta="1" aria-label="${escape(item.name)} ${SiteI18n.t('cart.increase')}"${item.quantity >= 9 ? ' disabled' : ''}>+</button><button type="button" class="remove" data-action="remove" data-index="${index}" aria-label="${escape(item.name)} ${SiteI18n.t('cart.remove')}">${SiteI18n.t('cart.remove')}</button></div>
      </article>`;
    }).join('');
    empty.classList.toggle('hidden', items.length > 0);
    itemsBox.classList.toggle('hidden', !items.length);
    document.getElementById('summary-count').textContent = items.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('summary-total').textContent = SiteI18n.currency(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    const missingSize = items.some(item => !SiteCatalog.optionsValid(item));
    const available = SiteCatalog.availableShows().length > 0;
    notice.textContent = SiteCatalog.error || (!available ? SiteI18n.t('cart.unavailable')
      : missingSize ? SiteI18n.t('cart.chooseSize') : SiteI18n.t('cart.sizeHint'));
    openButton.disabled = !items.length || missingSize || !available || submitting;
    if (!modal.classList.contains('hidden')) {
      SiteCatalog.fillShows(form.elements.showId);
      submit.disabled = submitting || !items.length || missingSize || !form.elements.showId.value;
      document.getElementById('order-items').textContent = items.map(item => `${item.name}${item.size ? ` (${item.size})` : ''} × ${item.quantity}`).join('\n');
    }
    if (focusIndex !== undefined && focusAction) {
      itemsBox.querySelector(`[data-index="${focusIndex}"][data-action="${focusAction}"]`)?.focus();
    }
  }
  itemsBox.addEventListener('change', event => {
    if (!event.target.matches('.cart-size')) return;
    if (!SiteCart.setSize(Number(event.target.dataset.index), event.target.value)) {
      render();
      notice.textContent = SiteI18n.t('cart.limit');
    }
  });
  itemsBox.addEventListener('click', event => {
    const button = event.target.closest('button[data-index]');
    if (!button) return;
    const items = SiteCart.read(), index = Number(button.dataset.index), item = items[index];
    if (!item) return;
    if (button.classList.contains('add-size')) {
      if (!SiteCart.add({ productId: item.productId })) notice.textContent = SiteI18n.t('cart.unselectedLimit');
      else itemsBox.querySelector('.cart-size:has(option[value=""]:checked)')?.focus();
      return;
    }
    if (button.classList.contains('remove')) items.splice(index, 1);
    else {
      item.quantity += Number(button.dataset.delta);
      if (item.quantity < 1) items.splice(index, 1);
    }
    SiteCart.write(items);
  });
  document.getElementById('clear-cart').addEventListener('click', () => SiteCart.clear());
  openButton.addEventListener('click', () => {
    if (submitting) return;
    render();
    if (openButton.disabled) return;
    clearTimeout(closeTimer);
    status.className = 'hidden';
    SiteCatalog.fillShows(form.elements.showId);
    dialog.open();
    render();
  });
  form.elements.showId.addEventListener('change', () => { submit.disabled = !form.elements.showId.value || submitting; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const items = SiteCart.read();
    if (submitting || !items.length || items.some(item => !SiteCatalog.optionsValid(item))) { render(); return; }
    const fields = Object.fromEntries(new FormData(form));
    if (!SiteCatalog.canPickup(SiteCatalog.show(fields.showId))) {
      render();
      status.className = 'block p-3 text-sm bg-red-950 text-red-100';
      status.textContent = SiteI18n.t('pickup.orderExpired');
      return;
    }
    if (!form.reportValidity()) return;
    submitting = true;
    submit.disabled = true;
    openButton.disabled = true;
    status.className = 'block p-3 text-sm bg-surface-container text-muted';
    status.textContent = SiteI18n.t('request.sendingBatch');
    let success = false;
    try {
      const response = await fetch(SiteI18n.api('reservations'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, items: items.map(({ productId, size, quantity }) => ({ productId, size, quantity })) })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(SiteI18n.responseMessage(result));
      success = true;
      SiteCart.removeSubmitted(items);
      status.className = 'block p-3 text-sm bg-primary text-surface';
      status.textContent = SiteI18n.t('request.successBatch');
      form.reset();
      closeTimer = setTimeout(dialog.close, 5000);
    } catch (error) {
      status.className = 'block p-3 text-sm bg-red-950 text-red-100';
      status.textContent = error.message === 'Failed to fetch' ? SiteI18n.t('request.network') : error.message;
    } finally {
      submitting = false;
      render();
      if (success) submit.disabled = true;
    }
  });
  window.addEventListener('cartchange', render);
  window.addEventListener('schedulechange', render);
  render();
})();
