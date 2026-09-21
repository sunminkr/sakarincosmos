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
          ${product.sizes.length ? `<label class="product-size-label">사이즈 <select class="cart-size" data-action="size" data-index="${index}" aria-label="${escape(item.name)} 사이즈" required><option value="">사이즈를 선택해 주세요</option>${product.sizes.map(size => `<option value="${size}"${item.size === size ? ' selected' : ''}>${size}</option>`).join('')}</select></label>
          <button type="button" class="add-size" data-index="${index}" data-action="add-size">다른 사이즈 추가 +</button>` : '<p class="cart-option-note">사이즈 선택 없음</p>'}
        </div>
        <div class="cart-quantity"><button type="button" class="qty" data-action="decrease" data-index="${index}" data-delta="-1" aria-label="${escape(item.name)} 수량 감소">−</button><span>${item.quantity}</span><button type="button" class="qty" data-action="increase" data-index="${index}" data-delta="1" aria-label="${escape(item.name)} 수량 증가"${item.quantity >= 9 ? ' disabled' : ''}>+</button><button type="button" class="remove" data-action="remove" data-index="${index}" aria-label="${escape(item.name)} 삭제">삭제</button></div>
      </article>`;
    }).join('');
    empty.classList.toggle('hidden', items.length > 0);
    itemsBox.classList.toggle('hidden', !items.length);
    document.getElementById('summary-count').textContent = items.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('summary-total').textContent = SiteI18n.currency(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    const missingSize = items.some(item => !SiteCatalog.optionsValid(item));
    const available = SiteCatalog.availableShows().length > 0;
    notice.textContent = SiteCatalog.error || (!available ? '현재 신청 가능한 공연이 없습니다. 선택한 물품은 장바구니에 보관됩니다.'
      : missingSize ? '티셔츠의 사이즈를 선택해 주세요.' : '같은 상품도 사이즈별로 담을 수 있습니다.');
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
      notice.textContent = '같은 상품과 사이즈는 최대 9개까지 담을 수 있습니다.';
    }
  });
  itemsBox.addEventListener('click', event => {
    const button = event.target.closest('button[data-index]');
    if (!button) return;
    const items = SiteCart.read(), index = Number(button.dataset.index), item = items[index];
    if (!item) return;
    if (button.classList.contains('add-size')) {
      if (!SiteCart.add({ productId: item.productId })) notice.textContent = '선택하지 않은 사이즈의 수량을 먼저 확인해 주세요.';
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
      status.textContent = '선택한 공연은 픽업이 마감되었습니다. 다른 공연을 선택해 주세요.';
      return;
    }
    if (!form.reportValidity()) return;
    submitting = true;
    submit.disabled = true;
    openButton.disabled = true;
    status.className = 'block p-3 text-sm bg-surface-container text-muted';
    status.textContent = '일괄 신청을 전송하고 있습니다.';
    let success = false;
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, items: items.map(({ productId, size, quantity }) => ({ productId, size, quantity })) })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || '전송에 실패했습니다. 다시 시도해 주세요.');
      success = true;
      SiteCart.removeSubmitted(items);
      status.className = 'block p-3 text-sm bg-primary text-surface';
      status.textContent = '일괄 신청이 담당자에게 발송되었습니다.';
      form.reset();
      closeTimer = setTimeout(dialog.close, 1800);
    } catch (error) {
      status.className = 'block p-3 text-sm bg-red-950 text-red-100';
      status.textContent = error.message === 'Failed to fetch' ? '메일 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' : error.message;
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
