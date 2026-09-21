const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Model the official Instagram SDK's iframe sizing so mobile overrides are exercised.
const instagramSDK = `window.instgrm = { Embeds: { process() {
  document.querySelectorAll('blockquote.instagram-media').forEach(block => {
    const frame = document.createElement('iframe');
    frame.className = 'instagram-media'; frame.title = 'Instagram post';
    frame.src = block.dataset.instgrmPermalink + 'embed/';
    frame.style.cssText = 'width:100%;min-width:326px;max-width:540px;height:680px';
    block.replaceWith(frame);
  });
} } };`;

async function mockProviders(context) {
  const widget = route => route.fulfill({ contentType: 'text/html', body: '<p>Mock provider embed</p>' });
  await context.route('https://w.soundcloud.com/**', widget);
  await context.route('https://www.youtube-nocookie.com/**', widget);
  await context.route('https://www.instagram.com/**/embed/**', widget);
  await context.route('https://www.instagram.com/embed.js', route => route.fulfill({ contentType: 'text/javascript', body: instagramSDK }));
}

async function checkMedia({ page, context, base, go, noOverflow, shot }) {
  const registered = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/media.json'), 'utf8'));
  const enabled = Object.entries(registered.entries).filter(([, entry]) => entry.enabled !== false);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go('index');
    for (const target of ['transmissions', 'observations', 'archive', 'objects', 'info']) {
      const nav = width < 1200 ? '.site-mobile-nav' : '.site-nav';
      if (width < 1200) await page.locator('.site-menu-toggle').click();
      await page.locator(`${nav} [data-path="${target}"]`).click();
      await page.waitForURL(`${base}/${target === 'info' ? 'index.html#info' : `${target}.html`}`);
      await page.evaluate(() => SiteCart.ready);
      await noOverflow(`navigation ${target} ${width}px`);
    }
    await page.locator('.site-cart').click();
    await page.waitForURL(`${base}/cart.html`);
    await page.locator('.site-brand').click();
    await page.waitForURL(`${base}/index.html`);
    const social = await page.locator('.site-header .site-social a').evaluateAll(links => links.map(link => link.href));
    assert.deepEqual(social, [registered.profiles.instagram, registered.profiles.youtube, registered.profiles.soundcloud]);
  }
  console.log('PASS navigation: six pages, info anchor, desktop/mobile and official profiles');

  await go('archive');
  assert.equal(await page.locator('.media-card').count(), enabled.length);
  assert.deepEqual((await page.locator('.media-card').evaluateAll(cards => cards.map(card => card.dataset.mediaId))).sort(), enabled.map(([id]) => id).sort());
  assert.equal(await page.locator('[data-provider-filter="all"] [data-count]').textContent(), String(enabled.length).padStart(2, '0'));
  const dates = await page.locator('.media-card time').evaluateAll(nodes => nodes.map(node => node.dateTime));
  const toTime = date => Date.parse(date.length === 10 ? date + 'T00:00:00+09:00' : date);
  assert.deepEqual(dates.map(toTime), dates.map(toTime).sort((a,b) => b-a));
  for (const provider of ['instagram', 'youtube', 'soundcloud']) {
    await page.locator(`[data-provider-filter="${provider}"]`).click();
    assert.equal(await page.locator('.media-card').count(), enabled.filter(([, e]) => new URL(e.url).hostname.includes(provider)).length);
    assert.equal(await page.locator(`.media-card:not([data-provider="${provider}"])`).count(), 0);
  }
  console.log(`PASS public content: ${enabled.length} registered posts, latest first, provider filters`);

  const title = '제목 교체 검사 <script>ignored</script>';
  const entry = (url, publishedAt) => ({ url, title, publishedAt, description: '콘텐츠 테스트 설명', enabled: true });
  let config = { entries: {
    'old-track': entry('https://soundcloud.com/embed-test/track', '2026-06-10T09:00:06Z'),
    'new-video': entry('https://youtu.be/0123456789_', '2026-09-20T13:03:19-07:00'),
    'new-photo': entry('https://www.instagram.com/p/TestPhoto/', '2026-09-20'),
    'playlist': entry('https://soundcloud.com/embed-test/sets/session', '2026-07-10'),
    'hidden': { ...entry('https://soundcloud.com/embed-test/hidden', '2026-09-22'), enabled: false }
  } };
  let unavailable = false;
  await page.route('**/data/media.json', route => route.fulfill({ status: unavailable ? 503 : 200, contentType: 'application/json', body: JSON.stringify(config) }));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await go('archive');
    await page.waitForSelector('.media-card[data-provider="instagram"] iframe');
    const order = await page.locator('.media-card').evaluateAll(cards => cards.map(card => card.dataset.mediaId));
    assert.deepEqual(order, ['new-video', 'new-photo', 'playlist', 'old-track']);
    assert.equal(await page.locator('.media-card h2').first().textContent(), title);
    assert.equal(await page.locator('.media-card script').count(), 0);
    for (const frame of await page.locator('.media-embed iframe').all()) {
      const box = await frame.boundingBox();
      assert.ok(box.width <= width, `${width}px: embed overflows phone`);
    }
    const sound = new URL(await page.locator('[data-media-id="old-track"] iframe').getAttribute('src'));
    assert.equal(sound.searchParams.get('url'), 'https://soundcloud.com/embed-test/track');
    assert.equal(sound.searchParams.get('auto_play'), 'false');
    assert.equal((await page.locator('[data-media-id="old-track"] iframe').boundingBox()).height, 166);
    assert.equal((await page.locator('[data-media-id="playlist"] iframe').boundingBox()).height, 450);
    const video = await page.locator('[data-media-id="new-video"] iframe').boundingBox();
    assert.ok(video.width >= 200 && video.height >= 200);
    await noOverflow(`archive embeds ${width}px`);
    if (width === 390) await shot('archive-embeds-mobile');
    await page.locator('[data-provider-filter="soundcloud"]').click();
    assert.equal(await page.locator('.media-video, iframe.instagram-media').count(), 0, 'Filtered embeds must be removed');
    await page.locator('[data-provider-filter="instagram"]').click();
    await page.waitForSelector('iframe.instagram-media');
    assert.equal(await page.locator('.media-audio, .media-playlist').count(), 0);
    await noOverflow(`Instagram ${width}px`);
    if (width === 390) await shot('instagram-embed-mobile');

    await go('transmissions');
    assert.equal(await page.locator('.media-card').count(), 3);
    assert.equal(await page.locator('[data-provider="instagram"]').count(), 0);
    await noOverflow(`transmissions ${width}px`);
    await go('index');
    assert.equal(await page.locator('#home-featured .media-card').getAttribute('data-media-id'), 'new-video');
    assert.equal(await page.locator('#home-archive .media-card').count(), 3);
    await noOverflow(`home ${width}px`);
  }
  console.log('PASS media: all embeds, chronological home previews, disabled entries and 320–1440px layouts');

  delete config.entries['new-video'];
  await go('index');
  assert.equal(await page.locator('#home-featured .media-card').getAttribute('data-media-id'), 'playlist', 'Deleting the latest record updates the home feature');
  await go('archive');
  assert.equal(await page.locator('.media-card').count(), 3);
  config = { entries: {} };
  await go('archive');
  assert.equal(await page.locator('.media-card, iframe').count(), 0);
  assert.match(await page.locator('[data-feed-status]').textContent(), /등록된 콘텐츠가 없/);
  await go('index');
  assert.match(await page.locator('#home-featured').textContent(), /등록된 음악·영상이 없/);

  config = { entries: { copied: entry('https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F123&auto_play=true', '2026-06-10') } };
  await go('transmissions');
  const imported = new URL(await page.locator('.media-audio').getAttribute('src'));
  assert.equal(imported.searchParams.get('url'), 'https://api.soundcloud.com/tracks/123');
  assert.equal(imported.searchParams.get('auto_play'), 'false');
  config = { entries: {
    invalid1: entry('javascript:alert(1)', ''),
    invalid2: entry('https://soundcloud.com.evil.example/user/track', ''),
    invalid3: entry('https://example.com/song.mp3', '')
  } };
  await go('archive');
  assert.equal(await page.locator('.media-card, iframe, audio').count(), 0);
  unavailable = true;
  await go('archive');
  assert.match(await page.locator('[data-feed-status]').textContent(), /불러오지 못/);
  await page.unroute('**/data/media.json');
  console.log('PASS editing: deletion, hide/show, empty feed, invalid sources and network failure');
}
module.exports = checkMedia;
module.exports.mockProviders = mockProviders;
