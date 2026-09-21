(async () => {
  await SiteCatalog.ready;
  function renderShows() {
    const shows = SiteCatalog.shows.filter(show => !SiteCatalog.isPast(show));
    document.getElementById('home-show-count').textContent = String(shows.length).padStart(2, '0');
    document.getElementById('home-shows').innerHTML = shows.length ? shows.map(show => `
      <article class="home-show">
        <time datetime="${show.date}">${show.date.replaceAll('-', '.')}</time>
        <div><h3>${SiteCatalog.escape(show.venue)}</h3><p>${SiteCatalog.escape(show.title)} · ${show.doors}</p><p>${SiteCatalog.escape(show.city)}</p></div>
        ${SiteCatalog.canPickup(show) ? `<a href="${SiteI18n.href('objects')}?show=${show.id}#concert-selector-list">픽업 신청 →</a>` : '<span>픽업 일정 미정</span>'}
      </article>`).join('') : `<p class="p-space-md">${SiteCatalog.error || '예정된 공연이 없습니다. 새로운 일정을 기다려 주세요.'}</p>`;
  }
  window.addEventListener('schedulechange', renderShows);
  renderShows();
})();

(async () => {
  await SiteMedia.ready;
  const featured = SiteMedia.list(['soundcloud', 'youtube'])[0];
  const featuredBox = document.getElementById('home-featured');
  if (featured) featuredBox.replaceChildren(SiteMediaFeed.card(featured, 'h3'));
  else featuredBox.querySelector('p').textContent = SiteMedia.error || '등록된 음악·영상이 없습니다.';
  const recent = SiteMedia.list().filter(entry => entry.id !== featured?.id).slice(0, 3);
  const archive = document.getElementById('home-archive');
  if (recent.length) archive.replaceChildren(...recent.map(entry => SiteMediaFeed.card(entry, 'h3')));
  else archive.querySelector('p').textContent = SiteMedia.error || '등록된 기록이 없습니다.';
})();
