(function() {
      const playBtn = document.getElementById('playback-btn');
      const timeDisplay = document.getElementById('player-time');
      const progressBar = document.getElementById('scrub-progress');
      const scrubContainer = document.getElementById('scrub-container');
      
      let isPlaying = false;
      let seconds = 0;
      let interval = null;

      if (playBtn && timeDisplay && progressBar) {
        playBtn.addEventListener('click', function(e) {
          e.preventDefault();
          isPlaying = !isPlaying;
          
          const icon = playBtn.querySelector('span');
          if (isPlaying) {
            icon.textContent = 'pause';
            interval = setInterval(function() {
              if (seconds < 258) {
                seconds++;
                const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
                const secs = String(seconds % 60).padStart(2, '0');
                timeDisplay.textContent = mins + ':' + secs;
                const percent = (seconds / 258) * 100;
                progressBar.style.width = percent + '%';
              } else {
                clearInterval(interval);
                isPlaying = false;
                icon.textContent = 'play_arrow';
                seconds = 0;
              }
            }, 1000);
          } else {
            icon.textContent = 'play_arrow';
            clearInterval(interval);
          }
        });
      }

      if (scrubContainer && progressBar) {
        scrubContainer.addEventListener('click', function(e) {
          const rect = scrubContainer.getBoundingClientRect();
          const clickPos = (e.clientX - rect.left) / rect.width;
          seconds = Math.floor(clickPos * 258);
          const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
          const secs = String(seconds % 60).padStart(2, '0');
          if (timeDisplay) timeDisplay.textContent = mins + ':' + secs;
          progressBar.style.width = (clickPos * 100) + '%';
        });
      }
    })();

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
