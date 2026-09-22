(async () => {
  const buttons = [...document.querySelectorAll('.reserve-btn')];
  buttons.forEach(button => { button.disabled = true; });
  const tray = document.getElementById('reservation-tray');
  const list = document.getElementById('concert-selector-list');
  const status = document.getElementById('pickup-availability');
  const escape = SiteCatalog.escape;
  let selectedShow = new URLSearchParams(location.search).get('show');
  await SiteCatalog.ready;

  function renderShows() {
    const available = SiteCatalog.availableShows();
    const oldShow = selectedShow || list.querySelector('input:checked')?.value;
    selectedShow = available.some(show => show.id === oldShow) ? oldShow : available[0]?.id;
    list.innerHTML = SiteCatalog.shows.filter(show => show.pickup).map(show => {
      const open = SiteCatalog.canPickup(show);
      return `<label class="concert-row${open ? '' : ' concert-closed'}">
        <input name="pickup_show" type="radio" value="${show.id}" ${open ? '' : 'disabled'} ${show.id === selectedShow ? 'checked' : ''}>
        <span class="concert-description"><span class="concert-date">${show.date.replaceAll('-', '.')} · ${escape(show.startsAt ? `${SiteI18n.t('shows.start')} ${show.startsAt}` : SiteI18n.t('shows.timeUnknown'))}</span><strong>${escape(show.venue)}</strong><span>${escape(show.city)}</span></span>
        <span class="concert-status">${open ? SiteI18n.t('pickup.available') : SiteI18n.t('pickup.closed')}</span>
      </label>`;
    }).join('');
    status.textContent = SiteCatalog.error || (!available.length ? SiteI18n.t('pickup.noneUpcoming')
      : oldShow && oldShow !== selectedShow ? SiteI18n.t('pickup.changed')
      : SiteI18n.t('pickup.deadline'));
    buttons.forEach(button => { button.disabled = !available.length || !SiteCatalog.product(button.dataset.productId); });
    document.getElementById('tray-submit').disabled = !available.length;
    document.getElementById('pickup-status').textContent = SiteCatalog.error ? SiteI18n.t('status.unavailable')
      : available.length ? SiteI18n.t('status.open') : SiteI18n.t('status.closed');
    document.querySelectorAll('[data-reserve-status]').forEach(label => {
      label.textContent = available.length ? SiteI18n.t('status.ready') : SiteI18n.t('status.closedBadge');
    });
    updateVenueHint();
  }
  function updateVenueHint() {
    const show = SiteCatalog.show(selectedShow);
    document.getElementById('tray-venue-hint').textContent = SiteCatalog.canPickup(show)
      ? `PICKUP: ${SiteCatalog.showLabel(show)}` : SiteI18n.t('pickup.none');
  }
  buttons.forEach(button => {
    const product = SiteCatalog.product(button.dataset.productId);
    if (!product) return;
    const heading = button.closest('.catalog-item').querySelector('h2');
    heading.textContent = product.name;
    heading.nextElementSibling.textContent = SiteI18n.currency(product.price);
    if (product.sizes.length) {
      const label = document.createElement('label');
      label.className = 'product-size-label';
      label.innerHTML = `${SiteI18n.t('size.label')} <select class="product-size" aria-label="${escape(product.name)} ${SiteI18n.t('size.label')}"><option value="">${SiteI18n.t('size.choose')}</option>${product.sizes.map(size => `<option>${size}</option>`).join('')}</select>`;
      button.before(label);
    }
    button.addEventListener('click', () => {
      if (!SiteCatalog.availableShows().length) { renderShows(); return; }
      const select = button.parentElement.querySelector('.product-size');
      if (select && !select.value) {
        select.setCustomValidity(SiteI18n.t('size.validation')); select.reportValidity(); select.focus(); return;
      }
      const item = { productId: product.id, size: select?.value || '', quantity: 1 };
      if (!SiteCart.add(item)) { status.textContent = SiteI18n.t('cart.limit'); status.scrollIntoView({ block: 'center' }); return; }
      document.getElementById('tray-item-title').textContent = `${product.name}${item.size ? ` / ${item.size}` : ''} · ${SiteI18n.t('cart.added')}`;
      window.dispatchEvent(new CustomEvent('pickupselect', { detail: item }));
      updateVenueHint();
      tray.classList.remove('translate-y-full');
    });
  });
  list.addEventListener('change', event => { selectedShow = event.target.value; updateVenueHint(); });
  document.addEventListener('change', event => {
    if (event.target.matches('.product-size')) event.target.setCustomValidity('');
  });
  document.getElementById('tray-close').addEventListener('click', () => tray.classList.add('translate-y-full'));
  document.querySelectorAll('.filter-btn').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(other => {
      const active = other === button;
      other.classList.toggle('bg-on-surface', active);
      other.classList.toggle('text-surface', active);
      other.classList.toggle('bg-surface-container-low', !active);
      other.classList.toggle('text-outline', !active);
      other.classList.toggle('hover:text-on-surface', !active);
      other.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.catalog-item').forEach(item => {
      item.style.display = button.dataset.category === 'all' || item.dataset.itemCategory === button.dataset.category ? 'flex' : 'none';
    });
  }));
  document.getElementById('confirm-intent-btn').addEventListener('click', event => {
    const instructions = document.getElementById('pickup-instructions');
    instructions.hidden = !instructions.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!instructions.hidden));
  });
  window.addEventListener('schedulechange', renderShows);
  renderShows();
})();
