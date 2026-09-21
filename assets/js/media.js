// Only official embed URLs are constructed; no audio files or pasted HTML are executed.
(() => {
  const configURL = new URL('../../data/media.json', document.currentScript.src);
  const media = window.SiteMedia = { entries: {}, error: '' };
  let instagramScript;
  let instagramPending = false;
  function processInstagram() {
    if (instagramPending) return;
    instagramPending = true;
    if (!instagramScript) instagramScript = new Promise(resolve => {
      if (window.instgrm?.Embeds) { resolve(true); return; }
      const script = document.createElement('script');
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      script.onload = () => resolve(Boolean(window.instgrm?.Embeds));
      script.onerror = () => resolve(false);
      document.head.append(script);
    });
    instagramScript.then(loaded => {
      instagramPending = false;
      if (loaded) window.instgrm.Embeds.process();
    });
  }

  function sourceURL(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
      return url;
    } catch { return null; }
  }

  function resolve(value) {
    let url = sourceURL(value);
    if (!url) return null;
    // Accept the src copied from SoundCloud's Share → Embed dialog as well as a track URL.
    if (url.hostname === 'w.soundcloud.com' && url.pathname === '/player/') {
      url = sourceURL(url.searchParams.get('url'));
      if (!url) return null;
    }
    const path = url.pathname.split('/').filter(Boolean);
    const publicSound = ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'].includes(url.hostname)
      && (path.length === 2 || (path.length === 3 && path[1] === 'sets'));
    const apiSound = url.hostname === 'api.soundcloud.com' && path.length === 2
      && ['tracks', 'playlists'].includes(path[0]) && /^\d+$/.test(path[1]);
    if (publicSound || apiSound) {
      const embed = new URL('https://w.soundcloud.com/player/');
      embed.search = new URLSearchParams({ url: url.href, auto_play: 'false', color: '#bbc6e6',
        show_artwork: 'true', show_user: 'true', single_active: 'true', visual: 'false' });
      return { provider: 'SoundCloud', source: publicSound ? url.href : embed.href, embed: embed.href,
        playlist: path[1] === 'sets' || path[0] === 'playlists' };
    }
    let video;
    if (url.hostname === 'youtu.be' && path.length === 1) video = path[0];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') video = url.searchParams.get('v');
      else if (['embed', 'shorts', 'live'].includes(path[0]) && path.length === 2) video = path[1];
    }
    if (video && /^[\w-]{11}$/.test(video)) return {
      provider: 'YouTube', source: `https://www.youtube.com/watch?v=${video}`,
      embed: `https://www.youtube-nocookie.com/embed/${video}?autoplay=0&playsinline=1&rel=0`
    };
    if (['instagram.com', 'www.instagram.com'].includes(url.hostname)
      && ['p', 'reel'].includes(path[0]) && path.length === 2 && /^[\w-]+$/.test(path[1])) return {
      provider: 'Instagram', source: `https://www.instagram.com/${path[0]}/${path[1]}/`
    };
    return null;
  }

  media.get = id => {
    const entry = Object.hasOwn(media.entries, id) ? media.entries[id] : null;
    const source = entry && entry.enabled !== false && resolve(entry.url);
    return source ? { ...source, id, title: typeof entry.title === 'string' ? entry.title : '',
      description: typeof entry.description === 'string' ? entry.description : '',
      publishedAt: typeof entry.publishedAt === 'string' && Number.isFinite(Date.parse(entry.publishedAt)) ? entry.publishedAt : '',
      datePrecision: entry.datePrecision, author: typeof entry.author === 'string' ? entry.author : '',
      sourceOrder: Number.isFinite(entry.sourceOrder) ? entry.sourceOrder : 0 } : null;
  };
  const timestamp = entry => entry.publishedAt ? Date.parse(entry.publishedAt.length === 10
    ? `${entry.publishedAt}T00:00:00+09:00` : entry.publishedAt) : 0;
  media.list = (providers = []) => Object.keys(media.entries).map(media.get).filter(entry => entry
    && (!providers.length || providers.includes(entry.provider.toLowerCase())))
    .sort((a, b) => timestamp(b) - timestamp(a) || a.sourceOrder - b.sourceOrder || a.id.localeCompare(b.id));
  media.date = entry => {
    if (!entry.publishedAt) return '날짜 미확인';
    if (entry.publishedAt.length === 10) return entry.publishedAt.replaceAll('-', '.');
    return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(entry.publishedAt));
  };
  media.message = id => media.error || (media.entries[id]?.url
    ? '콘텐츠를 불러올 수 없습니다.' : '콘텐츠를 준비 중입니다.');
  media.mount = (container, id, { eager = false } = {}) => {
    const entry = media.get(id);
    container.replaceChildren();
    container.classList.add('media-embed');
    container.classList.toggle('media-instagram', entry?.provider === 'Instagram');
    if (!entry) {
      const message = document.createElement('p');
      message.className = 'media-empty';
      message.textContent = media.message(id);
      container.append(message);
      return;
    }
    const link = document.createElement('a');
    link.href = entry.source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'media-source';
    link.textContent = `${entry.provider}에서 열기 ↗`;
    if (entry.provider === 'Instagram') {
      const preview = document.createElement('div');
      preview.className = 'instagram-preview';
      // This is a bounded visual preview. Keep cropped iframe controls out of
      // keyboard navigation; the visible source link opens the complete post.
      preview.inert = true;
      preview.setAttribute('aria-hidden', 'true');
      const block = document.createElement('blockquote');
      block.className = 'instagram-media';
      block.dataset.instgrmPermalink = entry.source;
      block.dataset.instgrmVersion = '14';
      block.append(link.cloneNode(true));
      preview.append(block);
      link.textContent = 'Instagram에서 더 보기 ↗';
      link.setAttribute('aria-label', `${entry.title || '게시물'} — Instagram에서 전체 보기 (새 창)`);
      container.append(preview, link);
      processInstagram();
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = entry.embed;
      iframe.title = `${entry.title || 'Sakarin Cosmos'} — ${entry.provider}`;
      iframe.loading = eager ? 'eager' : 'lazy';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
      iframe.allowFullscreen = entry.provider === 'YouTube';
      iframe.className = entry.provider === 'YouTube' ? 'media-video' : entry.playlist ? 'media-playlist' : 'media-audio';
      container.append(iframe, link);
    }
  };
  media.ready = fetch(configURL, { cache: 'no-cache' }).then(async response => {
    if (!response.ok) throw new Error('media');
    const data = await response.json();
    if (!data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) throw new Error('media');
    media.entries = data.entries;
    media.profiles = data.profiles || {};
    return true;
  }).catch(() => {
    media.error = '콘텐츠 정보를 불러오지 못했습니다. 잠시 후 다시 방문해 주세요.';
    return false;
  });
})();
