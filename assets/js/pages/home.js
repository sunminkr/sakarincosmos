// Keep INFO on the introduction while content above it finishes loading.
// Native fragment scrolling alone does not follow these changes in every browser.
(() => {
  const about = document.getElementById('about');
  const isInfoLink = () => ['#about', '#info'].includes(location.hash);
  let following = false;
  let frame;
  const align = () => {
    if (!following) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (following && isInfoLink()) about.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  };
  const changes = new ResizeObserver(align);
  const stop = () => {
    following = false;
    changes.disconnect();
    cancelAnimationFrame(frame);
  };
  const follow = () => {
    stop();
    if (!isInfoLink()) return;
    following = true;
    changes.observe(document.querySelector('main'));
    align();
  };
  window.addEventListener('hashchange', follow);
  window.addEventListener('pageshow', align);
  // Repeated INFO clicks keep working even when the fragment is already #about.
  document.addEventListener('click', event => {
    if (event.button === 0 && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
      && event.target.closest('a[data-path="info"]')) follow();
  });
  ['wheel', 'touchstart', 'pointerdown'].forEach(type => window.addEventListener(type, stop, { passive: true }));
  window.addEventListener('keydown', event => {
    if (['Tab', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) stop();
  });
  follow();
})();

(async () => {
  await SiteCatalog.ready;
  function renderShows() {
    if (SiteCatalog.error) {
      // Keep the published schedule if the live data cannot be fetched.
      const status = document.getElementById('home-shows-status');
      status.textContent = SiteI18n.t('shows.saved');
      status.hidden = false;
      document.querySelectorAll('#home-shows .home-show').forEach(article => {
        const show = { date: article.querySelector('time').dateTime, pickup: true };
        if (SiteCatalog.isPast(show)) article.remove();
        else if (!SiteCatalog.canPickup(show)) {
          const closed = document.createElement('span');
          closed.textContent = SiteI18n.t('pickup.closed');
          article.querySelector('a')?.replaceWith(closed);
        }
      });
      const count = document.querySelectorAll('#home-shows .home-show').length;
      document.getElementById('home-show-count').textContent = String(count).padStart(2, '0');
      if (!count) {
        const empty = document.createElement('p');
        empty.className = 'p-space-md';
        empty.textContent = SiteI18n.t('shows.noUpcoming');
        document.getElementById('home-shows').replaceChildren(empty);
      }
      return;
    }
    const shows = SiteCatalog.shows.filter(show => !SiteCatalog.isPast(show));
    document.getElementById('home-show-count').textContent = String(shows.length).padStart(2, '0');
    document.getElementById('home-shows').innerHTML = shows.length ? shows.map(show => `
      <article class="home-show">
        <time datetime="${show.date}">${show.date.replaceAll('-', '.')}</time>
        <div><h3>${SiteCatalog.escape(show.venue)}</h3><p>${SiteCatalog.escape(show.title || SiteI18n.t('shows.titleUnknown'))} · ${SiteCatalog.escape(show.startsAt ? `${SiteI18n.t('shows.start')} ${show.startsAt}` : SiteI18n.t('shows.timeUnknown'))}</p><p>${SiteCatalog.escape(show.city)}</p></div>
        ${SiteCatalog.canPickup(show) ? `<a href="${SiteI18n.href('objects')}?show=${show.id}#concert-selector-list">${SiteI18n.t('pickup.link')}</a>` : `<span>${SiteI18n.t(show.pickup ? 'pickup.closed' : 'pickup.unknown')}</span>`}
      </article>`).join('') : `<p class="p-space-md">${SiteCatalog.error || SiteI18n.t('shows.noUpcoming')}</p>`;
  }
  window.addEventListener('schedulechange', renderShows);
  renderShows();
})();

(async () => {
  await SiteMedia.ready;
  if (SiteMedia.error) {
    const status = document.getElementById('home-media-status');
    status.textContent = SiteI18n.t('media.saved');
    status.hidden = false;
    return;
  }
  const empty = key => {
    const message = document.createElement('p');
    message.className = 'media-empty';
    message.textContent = SiteI18n.t(key);
    return message;
  };
  const featured = SiteMedia.list(['soundcloud', 'youtube'])[0];
  const featuredBox = document.getElementById('home-featured');
  if (featured) featuredBox.replaceChildren(SiteMediaFeed.card(featured, 'h3'));
  else featuredBox.replaceChildren(empty('media.noMusic'));
  const recent = SiteMedia.list().filter(entry => entry.id !== featured?.id).slice(0, 3);
  const archive = document.getElementById('home-archive');
  if (recent.length) archive.replaceChildren(...recent.map(entry => SiteMediaFeed.card(entry, 'h3')));
  else archive.replaceChildren(empty('media.noRecords'));
})();
