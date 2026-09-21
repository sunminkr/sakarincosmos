(async () => {
  await SiteCatalog.ready;
  const events = SiteCatalog.shows;
  const timeline = document.getElementById('timeline');
  const calendar = document.getElementById('calendar');
  const escape = SiteCatalog.escape;
  let filter = 'all', selectedDate = SiteCatalog.today();
  let [year, month] = selectedDate.split('-').map(Number);
  month -= 1;
  function renderTimeline() {
    document.querySelectorAll('.timeline-filter').forEach(button => {
      const kind = button.dataset.filter;
      const count = events.filter(show => kind === 'all' || (kind === 'past') === SiteCatalog.isPast(show)).length;
      button.textContent = `${{ all: 'ALL', future: 'UPCOMING', past: 'PAST' }[kind]} ${String(count).padStart(2, '0')}`;
      button.setAttribute('aria-pressed', String(filter === kind));
      button.classList.toggle('bg-paper', filter === kind);
      button.classList.toggle('text-surface', filter === kind);
      button.classList.toggle('bg-surface-low', filter !== kind);
      button.classList.toggle('text-muted', filter !== kind);
    });
    timeline.innerHTML = events.filter(show => filter === 'all' || (filter === 'past') === SiteCatalog.isPast(show)).map(show => `
      <article class="timeline-event bg-surface p-5 md:p-6${SiteCatalog.isPast(show) ? ' opacity-65' : ''}">
        <div class="timeline-date"><time datetime="${show.date}">${show.date.replaceAll('-', '.')}</time><span>${SiteCatalog.isPast(show) ? 'ARCHIVED' : 'UPCOMING'}</span></div>
        <div><p class="font-mono text-[9px] text-muted">${escape(show.city)} · DOORS ${show.doors}</p><h3 class="font-serif text-2xl mt-1">${escape(show.venue)}</h3><p class="text-sm text-muted mt-1">${escape(show.title)}</p></div>
      </article>`).join('') || `<p class="p-5 bg-surface text-muted">${SiteCatalog.error || '해당하는 공연이 없습니다.'}</p>`;
  }
  function showEvent(date) {
    selectedDate = date;
    const show = events.find(show => show.date === date);
    calendar.querySelectorAll('button').forEach(button => {
      const active = button.dataset.date === date;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('selected-event').innerHTML = `<time class="font-mono text-xs text-muted" datetime="${date}">${date.replaceAll('-', '.')}</time>` + (show ? `
      <div class="mt-6 border-t border-line/30 pt-6"><span class="font-mono text-[9px] text-primary">${SiteCatalog.isPast(show) ? 'ARCHIVED · 픽업 마감' : SiteCatalog.canPickup(show) ? 'PICKUP AVAILABLE' : '픽업 일정 미정'}</span>
        <h3 class="font-serif text-4xl mt-2">${escape(show.venue)}</h3><p class="font-serif italic text-xl text-muted mt-1">${escape(show.title)}</p>
        <dl class="event-details mt-6"><div><dt>LOCATION</dt><dd>${escape(show.city)}</dd></div><div><dt>DOORS</dt><dd>${show.doors}</dd></div></dl>
        <p class="text-sm text-muted leading-6 mt-6">${escape(show.note)}</p>
        ${SiteCatalog.canPickup(show) ? `<a href="${SiteI18n.href('objects')}?show=${show.id}#concert-selector-list" class="inline-block mt-6 bg-paper text-surface px-4 py-3 font-mono text-[10px]">픽업 신청 →</a>` : ''}
      </div>` : '<p class="text-sm text-muted leading-6 mt-6">이 날짜에는 등록된 공연이 없습니다.<br>점이 표시된 날짜를 선택해 주세요.</p>');
  }
  function renderCalendar() {
    document.getElementById('month-title').textContent = SiteI18n.date(new Date(year, month, 1), { year: 'numeric', month: 'long' });
    const cells = [];
    for (let i = 0; i < new Date(year, month, 1).getDay(); i++) cells.push('<div class="calendar-gap" aria-hidden="true"></div>');
    for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const show = events.find(show => show.date === date);
      cells.push(`<button type="button" class="calendar-cell${show ? ` event-day ${SiteCatalog.isPast(show) ? 'past' : 'future'}` : ''}" data-date="${date}" aria-label="${escape(date + (show ? ' ' + show.venue : ' 공연 없음'))}" aria-pressed="${selectedDate === date}"><span>${String(day).padStart(2, '0')}</span>${show ? `<span class="calendar-venue">${escape(show.venue)}</span>` : ''}</button>`);
    }
    calendar.innerHTML = cells.join('');
    showEvent(selectedDate);
  }
  document.querySelectorAll('.timeline-filter').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; renderTimeline(); }));
  calendar.addEventListener('click', event => {
    const button = event.target.closest('[data-date]');
    if (button) showEvent(button.dataset.date);
  });
  function moveMonth(delta) {
    const next = new Date(year, month + delta, 1);
    year = next.getFullYear(); month = next.getMonth();
    selectedDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    renderCalendar();
  }
  document.getElementById('prev-month').addEventListener('click', () => moveMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => moveMonth(1));
  document.getElementById('today').addEventListener('click', () => {
    selectedDate = SiteCatalog.today(); [year, month] = selectedDate.split('-').map(Number); month -= 1; renderCalendar();
  });
  window.addEventListener('schedulechange', () => { renderTimeline(); renderCalendar(); });
  renderTimeline(); renderCalendar();
})();
