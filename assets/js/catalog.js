(() => {
  const url = new URL('../../data/catalog.json', document.currentScript.src);
  const today = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const part = name => parts.find(item => item.type === name).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  const catalog = window.SiteCatalog = {
    shows: [], products: [], error: '', today,
    isPast: (show, now) => show.date < today(now),
    canPickup: (show, now) => Boolean(show?.pickup && !catalog.isPast(show, now)),
    availableShows: now => catalog.shows.filter(show => catalog.canPickup(show, now)),
    product: id => catalog.products.find(product => product.id === id),
    show: id => catalog.shows.find(show => show.id === id),
    showLabel: show => `${show.date.replaceAll('-', '.')} ${show.venue} · ${show.city.split(' / ')[0]}`,
    escape: value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    fillShows(select, selected = select.value) {
      const shows = catalog.availableShows();
      select.replaceChildren(...(shows.length
        ? shows.map(show => new Option(catalog.showLabel(show), show.id))
        : [new Option(catalog.error || SiteI18n.t('pickup.none'), '')]));
      if (shows.some(show => show.id === selected)) {
        select.value = selected;
        delete select.dataset.selectionExpired;
      } else if ((selected || select.dataset.selectionExpired) && shows.length) {
        select.dataset.selectionExpired = 'true';
        select.prepend(new Option(SiteI18n.t('pickup.expired'), '', true, true));
      }
      select.disabled = !shows.length;
    },
    optionsValid: item => {
      const product = catalog.product(item.productId);
      return Boolean(product && (product.sizes.length ? product.sizes.includes(item.size) : !item.size));
    }
  };
  catalog.ready = fetch(url, { cache: 'no-cache' }).then(async response => {
    if (!response.ok) throw new Error('catalog');
    const data = await response.json();
    if (!Array.isArray(data.shows) || !Array.isArray(data.products)) throw new Error('catalog');
    catalog.shows = data.shows.map(SiteI18n.localize).sort((a, b) => a.date.localeCompare(b.date));
    catalog.products = data.products;
    return true;
  }).catch(() => {
    catalog.error = SiteI18n.t('catalog.error');
    return false;
  });
  // An open tab must also expire after midnight in Seoul, or when revisited.
  let lastDay = today();
  function refresh() {
    const day = today();
    if (day !== lastDay) {
      lastDay = day;
      window.dispatchEvent(new Event('schedulechange'));
    }
  }
  setInterval(refresh, 30_000);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
})();
