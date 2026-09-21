// Home previews and both media pages use the same editable, dated source list.
(() => {
  function card(entry, heading = 'h2') {
    const article = document.createElement('article');
    article.className = 'media-card';
    article.dataset.mediaId = entry.id;
    article.dataset.provider = entry.provider.toLowerCase();
    const header = document.createElement('div');
    header.className = 'media-card-heading';
    const meta = document.createElement('div');
    meta.className = 'media-card-meta';
    const provider = document.createElement('span');
    provider.textContent = entry.provider;
    const time = document.createElement('time');
    if (entry.publishedAt) time.dateTime = entry.publishedAt;
    time.textContent = SiteMedia.date(entry);
    meta.append(provider, time);
    const title = document.createElement(heading);
    title.textContent = entry.title || SiteI18n.t('media.post', { provider: entry.provider });
    header.append(meta, title);
    if (entry.author) {
      const author = document.createElement('p');
      author.className = 'media-card-author';
      author.textContent = `@${entry.author}`;
      header.append(author);
    }
    const embed = document.createElement('div');
    article.append(header, embed);
    if (entry.description) {
      const description = document.createElement('p');
      description.className = 'media-card-description';
      description.textContent = entry.description;
      article.append(description);
    }
    SiteMedia.mount(embed, entry.id);
    return article;
  }

  window.SiteMediaFeed = { card };
  const root = document.querySelector('[data-media-feed]');
  if (!root) return;
  const grid = root.querySelector('[data-feed-grid]');
  const status = root.querySelector('[data-feed-status]');
  const buttons = [...root.querySelectorAll('[data-provider-filter]')];
  const providers = root.dataset.providers?.split(',').filter(Boolean) || [];
  let selected = 'all';

  async function render() {
    await SiteMedia.ready;
    if (SiteMedia.error) {
      status.textContent = SiteI18n.t('media.saved');
      return;
    }
    const all = SiteMedia.list(providers);
    const entries = all.filter(entry => selected === 'all' || entry.provider.toLowerCase() === selected);
    buttons.forEach(button => {
      button.disabled = false;
      const provider = button.dataset.providerFilter;
      const count = all.filter(entry => provider === 'all' || entry.provider.toLowerCase() === provider).length;
      button.querySelector('[data-count]').textContent = String(count).padStart(2, '0');
      button.setAttribute('aria-pressed', String(provider === selected));
    });
    // Replacing the nodes also stops media removed by a filter change.
    grid.replaceChildren(...entries.map(entry => card(entry)));
    status.textContent = SiteMedia.error || (entries.length ? SiteI18n.t('media.count', { count: entries.length }) : SiteI18n.t('media.none'));
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.providerFilter;
    render();
  }));
  render();
})();
