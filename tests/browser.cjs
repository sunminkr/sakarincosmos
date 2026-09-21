const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const socket = net.createServer().listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const root = path.resolve(__dirname, '..');
  const server = spawn('python3', ['-u', 'server.py'], {
    cwd: root, env: { ...process.env, SITE_PORT: String(port) }, stdio: 'ignore'
  });
  const base = `http://127.0.0.1:${port}`;
  let browser;
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await require('./media.cjs').mockProviders(context);
    await context.route('https://lh3.googleusercontent.com/**', route => route.abort());
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-09-21T03:00:00Z'));
    const errors = [];
    context.on('page', other => other.on('pageerror', error => errors.push(error.message)));
    page.on('pageerror', error => errors.push(error.message));
    const go = async name => {
      await page.goto(`${base}/${name}.html`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => { await SiteCatalog.ready; await window.SiteMedia?.ready; });
      await page.waitForFunction(() => getComputedStyle(document.querySelector('main')).paddingTop === '64px');
      await page.evaluate(() => document.fonts.ready);
    };
    const shot = async name => {
      if (!process.env.SITE_SCREENSHOTS) return;
      await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
      await page.screenshot({ path: path.join(root, `test-results/${name}.png`) });
    };
    const noOverflow = async label => {
      const size = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(size.page <= size.viewport + 1, `${label}: page width ${size.page} exceeds ${size.viewport}`);
    };
    let headerStyle;
    for (const name of ['index', 'transmissions', 'observations', 'archive', 'objects', 'cart']) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await go(name);
      const style = await page.locator('.site-header').evaluate(header => {
        const cs = getComputedStyle(header);
        return [cs.height, cs.backgroundColor, cs.backdropFilter,
          getComputedStyle(header.querySelector('.site-brand-title')).fontSize];
      });
      headerStyle ??= style;
      assert.deepEqual(style, headerStyle);
      assert.equal(await page.locator('.site-cart').count(), 1);
      assert.equal(await page.locator('.site-header .site-social a').count(), 3);
      assert.equal(await page.locator('.site-nav [aria-current="page"]').count(), ['index', 'cart'].includes(name) ? 0 : 1);
      for (const width of [320, 360, 390, 430, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await noOverflow(`${name} ${width}px`);
        if (width < 1200) {
          const toggle = page.locator('.site-menu-toggle');
          await toggle.click();
          assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
          await page.keyboard.press('Escape');
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        }
        if (width === 390) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await shot(`${name}-mobile`);
        }
      }
      console.log(`PASS ${name}: shared header and responsive widths 320–1440px`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await go('observations');
    assert.deepEqual(await page.locator('#timeline time').evaluateAll(nodes => nodes.map(node => node.dateTime)),
      ['2026-09-19', '2026-10-23', '2026-12-26']);
    assert.deepEqual(await page.locator('.timeline-filter').allTextContents(), ['ALL 03', 'UPCOMING 02', 'PAST 01']);
    await page.locator('[data-date="2026-09-19"]').click();
    assert.match(await page.locator('#selected-event').textContent(), /그럼에도 계속되는 것/);
    assert.match(await page.locator('#selected-event').textContent(), /클럽 빵/);
    assert.match(await page.locator('#selected-event').textContent(), /공연 시작18:30/);
    await page.locator('#next-month').click();
    await page.locator('[data-date="2026-10-23"]').click();
    assert.match(await page.locator('#selected-event').textContent(), /공연명 미정/);
    assert.match(await page.locator('#selected-event').textContent(), /시간 미정/);
    assert.match(await page.locator('#selected-event a').getAttribute('href'), /show=bbang-oct23/);
    await page.locator('#next-month').click();
    await page.locator('#next-month').click();
    await page.locator('[data-date="2026-12-26"]').click();
    assert.match(await page.locator('#selected-event').textContent(), /Sound Crue/);
    assert.match(await page.locator('#selected-event').textContent(), /일본 \/ 삿포로/);
    assert.match(await page.locator('#selected-event a').getAttribute('href'), /show=sound-crue/);
    await go('index');
    assert.deepEqual(await page.locator('#home-shows time').evaluateAll(nodes => nodes.map(node => node.dateTime)),
      ['2026-10-23', '2026-12-26']);
    assert.match(await page.locator('#home-shows').textContent(), /시간 미정/);
    assert.match(await page.locator('#home-shows').textContent(), /클럽 빵/);
    assert.equal(await page.locator('#home-shows a').count(), 2);
    assert.deepEqual(await page.locator('#home-products h3').allTextContents(), ['sakarin cosmos logo t-shirt']);
    assert.equal(await page.locator('#home-products img, #home-products [style*="background-image"]').count(), 0);
    assert.match(await page.locator('#home-products').textContent(), /₩25,000/);
    await go('objects');
    assert.equal(await page.locator('.reserve-btn:not(:disabled)').count(), 1);
    assert.deepEqual(await page.locator('[name="pickup_show"]:enabled').evaluateAll(nodes => nodes.map(node => node.value)), ['bbang-oct23', 'sound-crue']);
    assert.equal(await page.locator('[name="pickup_show"][value="bbang"]').isDisabled(), true);
    assert.match(await page.locator('#concert-selector-list').textContent(), /클럽 빵/);
    console.log('PASS published schedule: Korean venue name, three shows, two upcoming pickups and closed past show');

    assert.deepEqual(await page.locator('.catalog-item h2').allTextContents(), ['sakarin cosmos logo t-shirt']);
    assert.equal(await page.locator('#catalog-grid img, #catalog-grid [style*="background-image"]').count(), 0);
    assert.equal(await page.locator('.product-size').count(), 0, 'Unconfirmed sizes must not be displayed');
    assert.deepEqual(await page.evaluate(() => SiteCatalog.products), [
      { id: 'logo-t-shirt', name: 'sakarin cosmos logo t-shirt', price: 25000, sizes: [] }
    ]);
    await page.evaluate(() => {
      localStorage.setItem('sakarin-cosmos-cart-v1', JSON.stringify([
        { productId: 'orbit-tee', name: 'Orbit Tee', size: 'M', quantity: 1 },
        { productId: 'signal-keyring', quantity: 2 }
      ]));
      dispatchEvent(new Event('cartchange'));
    });
    assert.equal(await page.evaluate(() => SiteCart.count()), 0, 'Deleted demo products must not survive in old carts');
    assert.equal(await page.locator('[data-cart-count]').textContent(), '[0]');
    await page.evaluate(() => SiteCart.clear());
    console.log('PASS merchandise: one logo T-shirt, blank images, no invented options, removed demo cart entries');

    // Sizes and an extra size-free item exist only in this test fixture.
    const pickupCatalog = JSON.parse(await fs.readFile(path.join(root, 'data/catalog.json'), 'utf8'));
    pickupCatalog.products[0].sizes = ['S', 'M', 'L', 'XL'];
    pickupCatalog.products.push({ id: 'test-no-options', name: 'Test item', price: 14000, sizes: [] });
    const mockPickupCatalog = route => route.fulfill({ json: pickupCatalog });
    await context.route('**/data/catalog.json', mockPickupCatalog);
    await go('objects');
    assert.equal(await page.locator('[name="pickup_show"][value="bbang"]').isDisabled(), true);
    assert.equal(await page.locator('#pickup-status').textContent(), 'STATUS: PICKUP RESERVATION OPEN');
    assert.equal(await page.locator('[name="pickup_show"]:checked').inputValue(), 'bbang-oct23');
    await page.evaluate(() => SiteCart.clear());
    const firstCard = page.locator('.catalog-item').first();
    await firstCard.locator('.reserve-btn').click();
    assert.equal(await page.locator('[data-cart-count]').textContent(), '[0]', 'Size must be selected');
    await firstCard.locator('.product-size').selectOption('M');
    await firstCard.locator('.reserve-btn').click();
    await page.locator('#tray-close').click();
    await firstCard.locator('.product-size').selectOption('L');
    await firstCard.locator('.reserve-btn').click();
    assert.equal(await page.locator('[data-cart-count]').textContent(), '[2]');
    await noOverflow('objects tray');
    await shot('objects-tray-mobile');

    await go('cart');
    assert.equal(await page.locator('#cart-items article').count(), 2);
    assert.deepEqual(await page.locator('.cart-size').evaluateAll(nodes => nodes.map(node => node.value)), ['M', 'L']);
    await page.locator('.qty[data-delta="1"]').first().click();
    assert.equal(await page.locator('#summary-count').textContent(), '3');
    await page.locator('.add-size').first().click();
    assert.equal(await page.locator('#cart-items article').count(), 3);
    assert.equal(await page.locator('#open-order').isDisabled(), true);
    await page.locator('.cart-size').last().selectOption('XL');
    assert.equal(await page.locator('#open-order').isEnabled(), true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => SiteCart.ready);
    assert.deepEqual(await page.locator('.cart-size').evaluateAll(nodes => nodes.map(node => node.value)), ['M', 'L', 'XL']);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 740 });
      await noOverflow('populated cart');
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('cart-sizes-mobile');
    await page.locator('#open-order').click();
    const form = page.locator('#order-form');
    assert.equal(await form.locator('[name="showId"] option[value="bbang"]').count(), 0);
    assert.match(await page.locator('#order-items').textContent(), /sakarin cosmos logo t-shirt \(M\) × 2/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#order-modal').isVisible(), false);
    await page.locator('#open-order').click();
    await form.locator('[name="name"]').fill('테스트');
    await form.locator('[name="phone"]').fill('010-0000-0000');
    await form.locator('[name="email"]').fill('test@example.com');
    await form.locator('[name="privacy"]').check();
    await noOverflow('batch modal');
    await shot('cart-modal-mobile');
    let sent, fail = true;
    await page.route('**/api/reservations', route => {
      sent = route.request().postDataJSON();
      return route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: fail ? '{"message":"테스트 실패"}' : '{"ok":true}' });
    });
    await form.locator('[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('#order-status').textContent === '테스트 실패');
    assert.equal(await page.evaluate(() => SiteCart.count()), 4);
    fail = false;
    await form.locator('[type="submit"]').click();
    await page.waitForFunction(() => SiteCart.count() === 0);
    assert.equal(sent.showId, 'bbang-oct23');
    assert.deepEqual(sent.items, [
      { productId: 'logo-t-shirt', size: 'M', quantity: 2 },
      { productId: 'logo-t-shirt', size: 'L', quantity: 1 },
      { productId: 'logo-t-shirt', size: 'XL', quantity: 1 }
    ]);
    await page.unroute('**/api/reservations');
    console.log('PASS batch sizes: variants, persistence, missing-size guard, failed retry and payload');

    await go('objects');
    await page.locator('.product-size').first().selectOption('S');
    await page.locator('.reserve-btn').first().click();
    await page.locator('#tray-submit').click();
    const single = page.locator('#pickup-application-form');
    assert.equal(await single.locator('[name="option"]').inputValue(), 'S');
    await single.locator('[name="name"]').fill('테스트');
    await single.locator('[name="phone"]').fill('010-0000-0000');
    await single.locator('[name="email"]').fill('test@example.com');
    await single.locator('[name="privacy"]').check();
    await page.route('**/api/reservations', route => {
      sent = route.request().postDataJSON();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await single.locator('[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('#pickup-form-status').textContent.includes('접수'));
    assert.deepEqual(sent.items, [{ productId: 'logo-t-shirt', size: 'S', quantity: 1 }]);
    assert.equal(await page.evaluate(() => SiteCart.count()), 0);
    await page.unroute('**/api/reservations');
    console.log('PASS single pickup: option, canonical show ID, removes submitted variant');

    await go('cart');
    await page.evaluate(() => {
      localStorage.setItem('sakarin-cosmos-cart-v1', JSON.stringify([{ name: 'sakarin cosmos logo t-shirt', price: '₩25,000', quantity: 2 }]));
      dispatchEvent(new Event('cartchange'));
    });
    assert.equal(await page.locator('#summary-count').textContent(), '2');
    assert.equal(await page.locator('.cart-size').inputValue(), '');
    assert.equal(await page.locator('#open-order').isDisabled(), true);
    await page.locator('.cart-size').selectOption('M');
    await page.locator('.cart-size').selectOption('');
    assert.equal(await page.locator('#open-order').isDisabled(), true);
    await page.locator('.cart-size').selectOption('M');
    await page.evaluate(() => SiteCart.add({ productId: 'test-no-options' }));
    assert.equal(await page.locator('.cart-size').count(), 1);
    assert.equal(await page.locator('#open-order').isEnabled(), true);
    const otherTab = await context.newPage();
    await otherTab.goto(`${base}/observations.html`, { waitUntil: 'domcontentloaded' });
    await otherTab.evaluate(() => SiteCart.ready);
    await page.evaluate(() => SiteCart.clear());
    await otherTab.waitForFunction(() => document.querySelector('[data-cart-count]').textContent === '[0]');
    await otherTab.close();
    console.log('PASS old carts: migrate without guessing size, non-apparel, cross-tab changes');

    await go('observations');
    await page.locator('[data-date="2026-09-19"]').click();
    assert.equal(await page.locator('#selected-event a').count(), 0);
    await page.locator('#next-month').click();
    await page.locator('[data-date="2026-10-23"]').click();
    assert.match(await page.locator('#selected-event a').getAttribute('href'), /show=bbang-oct23/);
    const boundary = await page.evaluate(() => {
      const show = SiteCatalog.show('bbang');
      return [SiteCatalog.canPickup(show, new Date('2026-09-19T14:59:59Z')), SiteCatalog.canPickup(show, new Date('2026-09-19T15:00:00Z'))];
    });
    assert.deepEqual(boundary, [true, false]);
    await page.clock.setFixedTime(new Date('2026-10-23T14:59:00Z'));
    await go('objects');
    assert.equal(await page.locator('[name="pickup_show"][value="bbang-oct23"]').isEnabled(), true);
    await page.locator('.product-size').first().selectOption('M');
    await page.locator('.reserve-btn').first().click();
    await page.locator('#tray-submit').click();
    await page.clock.setFixedTime(new Date('2026-10-23T15:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    assert.equal(await page.locator('#pickup-application-form [type="submit"]').isDisabled(), true);
    await page.clock.setFixedTime(new Date('2026-10-23T14:59:00Z'));
    await go('cart');
    await page.locator('#open-order').click();
    assert.equal(await page.locator('#order-form [name="showId"]').inputValue(), 'bbang-oct23');
    await page.clock.setFixedTime(new Date('2026-10-23T15:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    assert.equal(await page.locator('#order-form [name="showId"]').inputValue(), '');
    await page.evaluate(() => window.dispatchEvent(new Event('cartchange')));
    assert.equal(await page.locator('#order-form [name="showId"]').inputValue(), '', 'Expired selection must not silently switch shows');
    assert.equal(await page.locator('#order-form [type="submit"]').isDisabled(), true);
    await page.locator('#order-form [name="showId"]').selectOption('sound-crue');
    assert.equal(await page.locator('#order-form [type="submit"]').isEnabled(), true);
    await page.clock.setFixedTime(new Date('2030-01-01T00:00:00Z'));
    await go('objects');
    assert.equal(await page.locator('.reserve-btn:not(:disabled)').count(), 0);
    assert.equal(await page.locator('#pickup-status').textContent(), 'STATUS: PICKUP CLOSED');
    assert.equal(await page.locator('[data-reserve-status]').first().textContent(), 'PICKUP CLOSED');
    await go('cart');
    assert.equal(await page.locator('#open-order').isDisabled(), true);
    await go('index');
    assert.equal(await page.locator('#home-shows a').count(), 0);
    console.log('PASS deadlines: Seoul midnight, open-tab expiry, no past links, no future pickup');

    await page.clock.setFixedTime(new Date('2026-09-21T03:00:00Z'));
    await page.route('**/data/catalog.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
    await go('objects');
    assert.equal(await page.locator('.reserve-btn:not(:disabled)').count(), 0);
    assert.match(await page.locator('#pickup-availability').textContent(), /불러오지 못/);
    await page.unroute('**/data/catalog.json');
    const temporaryCart = await context.newPage();
    await temporaryCart.addInitScript(() => Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage disabled', 'SecurityError'); }
    }));
    await temporaryCart.goto(`${base}/objects.html`, { waitUntil: 'domcontentloaded' });
    await temporaryCart.evaluate(() => SiteCart.ready);
    await temporaryCart.locator('.product-size').first().selectOption('M');
    await temporaryCart.locator('.reserve-btn').first().click();
    assert.equal(await temporaryCart.locator('[data-cart-count]').textContent(), '[1]');
    await temporaryCart.close();
    console.log('PASS catalog failure and disabled storage');

    await go('observations');
    const dictionaries = await page.evaluate(() => Object.values(SiteMessages).map(messages => Object.keys(messages).sort()));
    assert.deepEqual(dictionaries[0], dictionaries[1]);
    assert.deepEqual(dictionaries[0], dictionaries[2]);
    assert.equal(await page.evaluate(() => new URL(SiteI18n.href('objects', 'ja')).pathname), '/jp/objects.html');
    await require('./i18n.cjs')({ page, context, base, go, noOverflow, shot });
    await require('./prerender.cjs')({ browser, base });
    await require('./info.cjs')({ browser, base });
    await require('./media.cjs')({ page, context, base, go, noOverflow, shot });
    assert.deepEqual(errors, [], 'Browser JavaScript errors');
    console.log('All browser checks passed; reservation emails were mocked.');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
