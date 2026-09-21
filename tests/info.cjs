const assert = require('node:assert/strict');

module.exports = async ({ browser, base }) => {
  // Email recipients land directly on the directory URL with no previous page state.
  for (const javascript of [false, true]) {
    const cold = await browser.newContext({ javaScriptEnabled: javascript });
    await require('./media.cjs').mockProviders(cold);
    await cold.route('https://lh3.googleusercontent.com/**', route => route.abort());
    await cold.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.overflowAnchor = 'none';
    }));
    await cold.route('**/data/media.json', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue();
    });
    try {
      for (const [directory, width] of [['', 390], ['en/', 1440], ['jp/', 390]]) {
        const page = await cold.newPage();
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`${base}/${directory}#info`, { waitUntil: javascript ? 'domcontentloaded' : 'load' });
        await page.evaluate(async () => { await window.SiteMedia?.ready; await document.fonts.ready; });
        if (javascript) {
          await page.waitForFunction(() => {
            const top = document.getElementById('about').getBoundingClientRect().top;
            return top >= 0 && top < innerHeight / 2;
          });
        } else {
          // requestAnimationFrame polling is disabled together with page scripts.
          const box = await page.locator('#about').boundingBox();
          assert.ok(box.y >= 0 && box.y < 422, 'Native fragment navigation must show the introduction');
        }
        assert.equal(new URL(page.url()).hash, '#info');
        assert.equal(await page.locator('#info').count(), 1);
        assert.ok((await page.locator('#info .band-bio').textContent()).length > 100);
        assert.equal(await page.locator('footer#info').count(), 0);
        await page.close();
      }
    } finally {
      await cold.close();
    }
  }
  console.log('PASS INFO email links: /#info, /en/#info and /jp/#info on first load, with and without JavaScript');
  // Reproduce browsers without native scroll anchoring and a slow home feed.
  const context = await browser.newContext();
  await require('./media.cjs').mockProviders(context);
  await context.route('https://lh3.googleusercontent.com/**', route => route.abort());
  await context.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.style.overflowAnchor = 'none';
  }));
  try {
    const page = await context.newPage();
    const atAbout = () => page.waitForFunction(() => {
      const top = document.getElementById('about').getBoundingClientRect().top;
      return top >= 64 && top < innerHeight / 2;
    });
    for (const [width, directory, source] of [[390, '', 'objects'], [1440, 'en/', 'archive'], [390, 'jp/', 'transmissions']]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${base}/${directory}${source}.html`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      let releaseFeed;
      const delayedFeed = new Promise(resolve => { releaseFeed = resolve; });
      await page.route('**/data/media.json', async route => { await delayedFeed; await route.continue(); });
      if (width < 1200) await page.locator('.site-menu-toggle').click();
      const navigation = width < 1200 ? '.site-mobile-nav' : '.site-nav';
      await page.locator(`${navigation} [data-path="info"]`).click();
      await page.waitForURL(`${base}/${directory}index.html#about`, { waitUntil: 'domcontentloaded' });
      await atAbout();
      const originalScroll = await page.evaluate(() => scrollY);
      releaseFeed();
      await page.evaluate(async () => { await SiteMedia.ready; await document.fonts.ready; });
      await page.waitForSelector('#home-archive .media-card');
      await atAbout();
      assert.ok(await page.evaluate(() => scrollY) > originalScroll + 200, 'INFO must follow the introduction when the feed expands');

      // Once the visitor scrolls away, later content changes must not pull them back.
      const beforeScroll = await page.evaluate(() => scrollY);
      await page.mouse.move(width / 2, 400);
      await page.mouse.wheel(0, -500);
      await page.waitForFunction(original => scrollY < original - 100, beforeScroll);
      await page.waitForTimeout(250);
      const afterScroll = await page.evaluate(() => scrollY);
      await page.locator('#home-archive').evaluate(node => { node.style.paddingBottom = '500px'; });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.ok(Math.abs(await page.evaluate(() => scrollY) - afterScroll) < 2, 'Manual scrolling must stop automatic alignment');

      // Clicking INFO again with the same URL should return to the introduction.
      if (width < 1200) await page.locator('.site-menu-toggle').click();
      await page.locator(`${navigation} [data-path="info"]`).click();
      await atAbout();
      await page.unroute('**/data/media.json');
    }
    console.log('PASS INFO: cross-page navigation, delayed feeds without native scroll anchoring, manual scrolling and repeated clicks');
  } finally {
    await context.close();
  }
};
