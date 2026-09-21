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
        <span class="concert-description"><span class="concert-date">${show.date.replaceAll('-', '.')} · ${show.doors}</span><strong>${escape(show.venue)}</strong><span>${escape(show.city)}</span></span>
        <span class="concert-status">${open ? '픽업 신청 가능' : '픽업 마감'}</span>
      </label>`;
    }).join('');
    status.textContent = SiteCatalog.error || (!available.length ? '현재 신청 가능한 공연이 없습니다. 다음 공연 일정을 기다려 주세요.'
      : oldShow && oldShow !== selectedShow ? '선택한 공연의 픽업이 마감되었습니다. 신청 가능한 공연을 다시 확인해 주세요.'
      : '공연일이 지나면 서울 시간 기준으로 픽업 신청이 마감됩니다.');
    buttons.forEach(button => { button.disabled = !available.length || !SiteCatalog.product(button.dataset.productId); });
    document.getElementById('tray-submit').disabled = !available.length;
    document.getElementById('pickup-status').textContent = SiteCatalog.error ? 'STATUS: PICKUP UNAVAILABLE'
      : available.length ? 'STATUS: PICKUP RESERVATION OPEN' : 'STATUS: PICKUP CLOSED';
    document.querySelectorAll('[data-reserve-status]').forEach(label => {
      label.textContent = available.length ? 'READY TO RESERVE' : 'PICKUP CLOSED';
    });
    updateVenueHint();
  }
  function updateVenueHint() {
    const show = SiteCatalog.show(selectedShow);
    document.getElementById('tray-venue-hint').textContent = SiteCatalog.canPickup(show)
      ? `PICKUP: ${SiteCatalog.showLabel(show)}` : '현재 신청 가능한 공연이 없습니다.';
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
      label.innerHTML = `사이즈 <select class="product-size" aria-label="${escape(product.name)} 사이즈"><option value="">선택해 주세요</option>${product.sizes.map(size => `<option>${size}</option>`).join('')}</select>`;
      button.before(label);
    }
    button.addEventListener('click', () => {
      if (!SiteCatalog.availableShows().length) { renderShows(); return; }
      const select = button.parentElement.querySelector('.product-size');
      if (select && !select.value) {
        select.setCustomValidity('사이즈를 선택해 주세요.'); select.reportValidity(); select.focus(); return;
      }
      const item = { productId: product.id, size: select?.value || '', quantity: 1 };
      if (!SiteCart.add(item)) { status.textContent = '같은 상품과 사이즈는 최대 9개까지 담을 수 있습니다.'; status.scrollIntoView({ block: 'center' }); return; }
      document.getElementById('tray-item-title').textContent = `${product.name}${item.size ? ` / ${item.size}` : ''} · 장바구니에 담았습니다`;
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
      other.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('.catalog-item').forEach(item => {
      item.style.display = button.dataset.category === 'all' || item.dataset.itemCategory === button.dataset.category ? 'flex' : 'none';
    });
  }));
  document.getElementById('confirm-intent-btn').addEventListener('click', () => {
    document.getElementById('pickup-instructions').hidden = !document.getElementById('pickup-instructions').hidden;
  });
  window.addEventListener('schedulechange', renderShows);
  renderShows();
})();
