const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async ({ browser, base }) => {
  const media = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/media.json'), 'utf8'));
  const video = media.entries['youtube-i7-C-GW8MZ8'];
  for (const javascript of [false, true]) {
    const context = await browser.newContext({ javaScriptEnabled: javascript, viewport: { width: 390, height: 844 } });
    await require('./media.cjs').mockProviders(context);
    await context.route('https://lh3.googleusercontent.com/**', route => route.abort());
    await context.route('**/data/media.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
    await context.route('**/data/catalog.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      if (javascript) await page.clock.setFixedTime(new Date('2026-09-21T03:00:00Z'));
      for (const directory of ['', 'en/', 'jp/']) {
        await page.goto(`${base}/${directory}index.html`, { waitUntil: 'domcontentloaded' });
        if (javascript) await page.evaluate(async () => { await SiteMedia.ready; await SiteCatalog.ready; });
        assert.equal(await page.locator('#home-featured h3').textContent(), video.title);
        assert.equal(await page.locator('#home-featured a').getAttribute('href'), video.url);
        assert.deepEqual(await page.locator('#home-shows time').evaluateAll(nodes => nodes.map(node => node.dateTime)), ['2026-10-23', '2026-12-26']);
        assert.match(await page.locator('#home-shows h3').first().textContent(), directory ? /Club BBang/ : /클럽 빵/);
        assert.ok((await page.locator('#about .band-bio').textContent()).length > 100);
        assert.equal(await page.locator('footer a[href="mailto:hello@sakarincosmos.com"]').isVisible(), true);
        assert.doesNotMatch(await page.locator('main').innerText(), /불러오는 중|Loading|読み込み中/);
        assert.equal(await page.locator('#home-featured iframe').count(), 0, 'Source links remain usable without players');
      }
      for (const name of ['transmissions', 'archive', 'observations']) {
        await page.goto(`${base}/${name}.html`, { waitUntil: 'domcontentloaded' });
        if (javascript) await page.evaluate(async () => { await SiteCatalog.ready; await window.SiteMedia?.ready; });
        if (name === 'observations') {
          assert.equal(await page.locator('#timeline article').count(), 3);
          assert.match(await page.locator('#timeline').innerText(), /그럼에도 계속되는 것/);
          assert.equal(await page.locator('#calendar-ledger').isVisible(), false);
        } else {
          assert.equal(await page.locator('[data-feed-grid] .media-card').count(), name === 'archive' ? 5 : 2);
          assert.equal(await page.locator(`[data-feed-grid] a[href="${video.url}"]`).count(), 1);
          assert.equal(await page.locator('[data-provider-filter]:enabled').count(), 0);
        }
        assert.doesNotMatch(await page.locator('main').innerText(), /불러오는 중/);
        assert.equal(await page.locator('footer a[href="mailto:hello@sakarincosmos.com"]').isVisible(), true);
      }
      // Published dates must not re-open expired pickups during a data outage.
      if (javascript) {
        await page.clock.setFixedTime(new Date('2026-10-20T14:59:59Z'));
        await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => SiteCatalog.ready);
        assert.equal(await page.locator('#home-shows a').count(), 2);
        await page.clock.setFixedTime(new Date('2026-10-20T15:00:00Z'));
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        assert.equal(await page.locator('#home-shows a').count(), 1);
        assert.equal(await page.locator('#home-shows .home-show').count(), 2, 'Closed pickups remain upcoming shows');
        assert.match(await page.locator('#home-shows .home-show').first().innerText(), /픽업 마감/);
        await page.clock.setFixedTime(new Date('2030-01-01T00:00:00Z'));
        await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => SiteCatalog.ready);
        assert.equal(await page.locator('#home-shows a').count(), 0);
      }
      assert.deepEqual(errors, [], 'Content fallbacks must not cause script errors');
    } finally {
      await context.close();
    }
  }
  console.log('PASS public HTML: video, upcoming shows, biography and contact without JavaScript or data APIs; full media and show records remain readable');
};
