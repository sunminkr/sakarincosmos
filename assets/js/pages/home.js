// Keep INFO on the introduction while content above it finishes loading.
// Native fragment scrolling alone does not follow these changes in every browser.
(() => {
  const about = document.getElementById('about');
  let following = false;
  let frame;
  const align = () => {
    if (!following) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (following && location.hash === '#about') about.scrollIntoView({ block: 'start', behavior: 'instant' });
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
    if (location.hash !== '#about') return;
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
    const shows = SiteCatalog.shows.filter(show => !SiteCatalog.isPast(show));
    document.getElementById('home-show-count').textContent = String(shows.length).padStart(2, '0');
    document.getElementById('home-shows').innerHTML = shows.length ? shows.map(show => `
      <article class="home-show">
        <time datetime="${show.date}">${show.date.replaceAll('-', '.')}</time>
        <div><h3>${SiteCatalog.escape(show.venue)}</h3><p>${SiteCatalog.escape(show.title || SiteI18n.t('shows.titleUnknown'))} · ${SiteCatalog.escape(show.startsAt ? `${SiteI18n.t('shows.start')} ${show.startsAt}` : SiteI18n.t('shows.timeUnknown'))}</p><p>${SiteCatalog.escape(show.city)}</p></div>
        ${SiteCatalog.canPickup(show) ? `<a href="${SiteI18n.href('objects')}?show=${show.id}#concert-selector-list">${SiteI18n.t('pickup.link')}</a>` : `<span>${SiteI18n.t('pickup.unknown')}</span>`}
      </article>`).join('') : `<p class="p-space-md">${SiteCatalog.error || SiteI18n.t('shows.noUpcoming')}</p>`;
  }
  window.addEventListener('schedulechange', renderShows);
  renderShows();
})();

(async () => {
  await SiteMedia.ready;
  const featured = SiteMedia.list(['soundcloud', 'youtube'])[0];
  const featuredBox = document.getElementById('home-featured');
  if (featured) featuredBox.replaceChildren(SiteMediaFeed.card(featured, 'h3'));
  else featuredBox.querySelector('p').textContent = SiteMedia.error || SiteI18n.t('media.noMusic');
  const recent = SiteMedia.list().filter(entry => entry.id !== featured?.id).slice(0, 3);
  const archive = document.getElementById('home-archive');
  if (recent.length) archive.replaceChildren(...recent.map(entry => SiteMediaFeed.card(entry, 'h3')));
  else archive.querySelector('p').textContent = SiteMedia.error || SiteI18n.t('media.noRecords');
})();
