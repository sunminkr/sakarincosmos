const assert = require('node:assert/strict');

module.exports = async ({ page, context, base, go, noOverflow, shot }) => {
  const pages = ['index', 'transmissions', 'observations', 'archive', 'objects', 'cart'];
  for (const [locale, directory] of [['ko', ''], ['en', 'en/'], ['ja', 'jp/']]) {
    for (const name of pages) {
      await go(`${directory}${name}`);
      assert.equal(await page.locator('html').getAttribute('lang'), locale);
      assert.equal(await page.evaluate(() => SiteCatalog.error), '');
      const hooks = await page.locator('[data-i18n]').evaluateAll(nodes => nodes.filter(node => {
        // Loading/status slots are intentionally replaced by current data.
        if (node.closest('#home-shows') || ['pickup-status', 'tray-venue-hint'].includes(node.id)
          || node.hasAttribute('data-reserve-status') || node.hasAttribute('data-feed-status')) return false;
        return node.textContent.trim() !== SiteI18n.t(node.dataset.i18n).trim();
      }).map(node => node.dataset.i18n));
      assert.deepEqual(hooks, [], `${directory}${name}: translated copy`);
      for (const width of [320, 390, 430, 768, 1280, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await noOverflow(`${directory}${name} ${width}px`);
        const links = page.locator('.site-header .site-social a');
        for (const link of await links.all()) {
          assert.equal(await link.isVisible(), true, 'Social icons must stay in the top bar on mobile');
          const box = await link.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 64);
        }
        if (width === 390 && name === 'index') await shot(`${locale}-home-mobile`);
      }
      if (name === 'index') {
        const bio = await page.evaluate(() => SiteI18n.t('band.bio'));
        assert.equal(await page.locator('#about .band-bio').textContent(), bio);
        assert.equal(await page.locator('.site-footer-tagline').textContent(), await page.evaluate(() => SiteI18n.t('band.tagline')));
        await page.locator('.site-nav [data-path="info"]').click();
        await page.waitForURL(`${base}/${directory}index.html#about`);
      }
      if (locale !== 'ko' && name === 'objects') {
        assert.doesNotMatch(await page.locator('#concert-selector-list').textContent(), /[가-힣]/);
      }
    }
  }
  // Language changes preserve the selected show and anchor, and the cart is shared.
  await page.setViewportSize({ width: 390, height: 844 });
  await go('objects');
  await page.goto(`${base}/objects.html?show=bbang-oct23#concert-selector-list`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => SiteCart.ready);
  await page.evaluate(() => { SiteCart.clear(); SiteCart.add({ productId: 'logo-t-shirt', size: 'M' }); });
  for (const [locale, directory] of [['en', 'en'], ['ja', 'jp']]) {
    await page.locator('.site-menu-toggle').click();
    await page.locator(`.site-mobile-nav .site-language [lang="${locale}"]`).click();
    await page.waitForURL(`${base}/${directory}/objects.html?show=bbang-oct23#concert-selector-list`);
    await page.evaluate(() => SiteCart.ready);
    assert.equal(await page.evaluate(() => SiteCart.count()), 1);
    assert.equal(await page.locator('[name="pickup_show"]:checked').inputValue(), 'bbang-oct23');
    await page.locator('.product-size').selectOption('L');
    await page.locator('.reserve-btn').click();
    await page.locator('#tray-submit').click();
    assert.equal(await page.locator('#pickup-modal-title').textContent(), await page.evaluate(() => SiteI18n.t('form.pickupTitle')));
    assert.doesNotMatch(await page.locator('#pickup-application-form').innerText(), /[가-힣]/);
    await noOverflow(`${locale} single pickup form`);
    await page.keyboard.press('Escape');
    await page.locator('.site-cart').click();
    await page.waitForURL(`${base}/${directory}/cart.html`);
    await page.locator('#open-order').click();
    assert.doesNotMatch(await page.locator('#order-form').innerText(), /[가-힣]/);
    const form = page.locator('#order-form');
    await form.locator('[name="name"]').fill('Language test');
    await form.locator('[name="phone"]').fill('010-0000-0000');
    await form.locator('[name="email"]').fill('test@example.com');
    await form.locator('[name="privacy"]').check();
    await page.route('**/api/reservations', route => route.fulfill({status:503,json:{code:'request.mailUnconfigured',message:'메일 서버가 아직 설정되지 않았습니다.'}}));
    await form.locator('[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('#order-status').textContent === SiteI18n.t('request.mailUnconfigured'));
    await noOverflow(`${locale} batch pickup form`);
    await page.keyboard.press('Escape');
    await page.unroute('**/api/reservations');
    await page.goto(`${base}/${directory}/objects.html?show=bbang-oct23#concert-selector-list`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => SiteCart.ready);
    await page.evaluate(() => { SiteCart.clear(); SiteCart.add({ productId: 'logo-t-shirt', size: 'M' }); });
  }
  await page.evaluate(() => SiteCart.clear());
  // Content-load failures must be localized too.
  await page.route('**/data/catalog.json', route => route.fulfill({status:503,body:'unavailable'}));
  await go('en/objects');
  assert.equal(await page.locator('#pickup-availability').textContent(), await page.evaluate(() => SiteI18n.t('catalog.error')));
  await page.unroute('**/data/catalog.json');
  await go('observations');
  console.log('PASS languages: 18 pages, JP paths, supplied biography, mobile social icons, language switching, shared cart and localized forms/errors');
};
