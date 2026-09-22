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

    await require('./product-gallery.cjs')({ page, context, go, noOverflow, shot });
    await require('./objects-layout.cjs')({ page, go, noOverflow, shot });
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
    assert.deepEqual(await page.locator('#home-products h3').allTextContents(), ['sakarin cosmos logo t-shirt', 'sakarin cosmos flower keyring', 'sakarin cosmos slogan towel']);
    assert.equal(await page.locator('#home-products img').count(), 5);
    const homeProductImage = page.locator('#home-products img').first();
    await homeProductImage.scrollIntoViewIfNeeded();
    await homeProductImage.evaluate(image => image.decode());
    assert.equal(await homeProductImage.isVisible(), true);
    assert.ok(await homeProductImage.evaluate(image => image.naturalWidth > 0));
    assert.match(await page.locator('#home-products').textContent(), /₩25,000/);
    await go('objects');
    assert.equal(await page.locator('.reserve-btn:not(:disabled)').count(), 4);
    assert.deepEqual(await page.locator('[name="pickup_show"]:enabled').evaluateAll(nodes => nodes.map(node => node.value)), ['bbang-oct23', 'sound-crue']);
    assert.equal(await page.locator('[name="pickup_show"][value="bbang"]').isDisabled(), true);
    assert.match(await page.locator('#concert-selector-list').textContent(), /클럽 빵/);
    console.log('PASS published schedule: Korean venue name, three shows, two upcoming pickups and closed past show');

    assert.deepEqual(await page.locator('.catalog-item h2').allTextContents(), [
      'sakarin cosmos logo t-shirt', 'sakarin cosmos flower keyring', 'sakarin cosmos slogan towel', 'sakarin cosmos sticker sheet'
    ]);
    assert.equal(await page.locator('#catalog-grid img').count(), 6);
    assert.equal(await page.locator('#catalog-grid .product-image-placeholder').count(), 0);
    assert.equal(await page.locator('.product-size').isVisible(), true);
    assert.deepEqual(await page.locator('.product-size option').evaluateAll(options => options.map(option => option.value)),
      ['', 'XS', 'S', 'M', 'L', 'XL']);
    assert.deepEqual(await page.evaluate(() => SiteCatalog.products), [
      { id: 'logo-t-shirt', name: 'sakarin cosmos logo t-shirt', price: 25000, sizes: ['XS', 'S', 'M', 'L', 'XL'] },
      { id: 'flower-keyring', name: 'sakarin cosmos flower keyring', price: 8000, sizes: [] },
      { id: 'slogan-towel', name: 'sakarin cosmos slogan towel', price: 15000, sizes: [] },
      { id: 'sticker-sheet', name: 'sakarin cosmos sticker sheet', price: 3500, sizes: [] }
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
    console.log('PASS merchandise: four products, six product photos, XS–XL sizes, removed demo cart entries');

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
    await page.locator('.product-size').first().selectOption('XS');
    await page.locator('.reserve-btn').first().click();
    await page.locator('#tray-submit').click();
    const single = page.locator('#pickup-application-form');
    assert.equal(await single.locator('[name="option"]').inputValue(), 'XS');
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
    assert.deepEqual(sent.items, [{ productId: 'logo-t-shirt', size: 'XS', quantity: 1 }]);
    assert.equal(await page.evaluate(() => SiteCart.count()), 0);
    await page.unroute('**/api/reservations');
    console.log('PASS single pickup: option, canonical show ID, removes submitted variant');

    await go('objects');
    const keyring = page.locator('#flower-keyring');
    await page.route('**/api/reservations', route => {
      sent = route.request().postDataJSON();
      return route.fulfill({ status: 200, json: { ok: true } });
    });
    for (const product of [
      { id: 'flower-keyring', category: 'keyring', price: 8000, dimensions: ['44 × 44 mm', '76 mm'] },
      { id: 'slogan-towel', category: 'towel', price: 15000, dimensions: ['100 × 20 cm'] },
      { id: 'sticker-sheet', category: 'sticker', price: 3500, dimensions: ['A5 (148 × 210 mm)'] }
    ]) {
      const card = page.locator(`#${product.id}`);
      await page.locator(`[data-category="${product.category}"]`).click();
      assert.equal(await card.isVisible(), true);
      assert.equal(await page.locator('.catalog-item:visible').count(), 1);
      assert.deepEqual(await card.locator('.product-dimensions dd').allTextContents(), product.dimensions);
      assert.equal(await card.locator('.product-size').count(), 0);
      await card.locator('img').scrollIntoViewIfNeeded();
      await card.locator('img').evaluate(image => image.decode());
      await noOverflow(`${product.id} filter`);
      await shot(`${product.id}-mobile`);
      await card.locator('.reserve-btn').click();
      assert.equal(await page.evaluate(() => SiteCart.read()[0].unitPrice), product.price);
      await page.locator('#tray-submit').click();
      assert.equal(await single.locator('[name="option"]').isVisible(), false);
      assert.equal(await single.locator('[name="option"]').inputValue(), '');
      await single.locator('[name="name"]').fill('굿즈 테스트');
      await single.locator('[name="phone"]').fill('010-0000-0000');
      await single.locator('[name="email"]').fill('test@example.com');
      await single.locator('[name="privacy"]').check();
      await single.locator('[type="submit"]').click();
      await page.waitForFunction(() => SiteCart.count() === 0);
      assert.deepEqual(sent.items, [{ productId: product.id, size: '', quantity: 1 }]);
      await page.keyboard.press('Escape');
    }
    await page.locator('[data-category="tshirt"]').click();
    assert.equal(await keyring.isVisible(), false);
    assert.equal(await firstCard.isVisible(), true);
    await page.locator('[data-category="all"]').click();
    assert.equal(await page.locator('.catalog-item:visible').count(), 4);
    await firstCard.locator('.product-size').selectOption('XS');
    await firstCard.locator('.reserve-btn').click();
    await page.locator('#tray-close').click();
    await keyring.locator('.reserve-btn').click();
    await page.locator('#tray-close').click();
    await page.locator('#slogan-towel .reserve-btn').click();
    await page.locator('#tray-close').click();
    await page.locator('#sticker-sheet .reserve-btn').click();
    await page.locator('#tray-close').click();
    await page.locator('#sticker-sheet .reserve-btn').click();
    await go('cart');
    assert.equal(await page.locator('#summary-total').textContent(), '₩55,000');
    assert.equal(await page.locator('.cart-size').count(), 1);
    assert.equal(await page.locator('.cart-option-note').count(), 3);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => SiteCart.ready);
    assert.equal(await page.locator('#summary-count').textContent(), '5');
    await page.locator('#open-order').click();
    const mixed = page.locator('#order-form');
    await mixed.locator('[name="name"]').fill('혼합 주문 테스트');
    await mixed.locator('[name="phone"]').fill('010-0000-0000');
    await mixed.locator('[name="email"]').fill('test@example.com');
    await mixed.locator('[name="privacy"]').check();
    await mixed.locator('[type="submit"]').click();
    await page.waitForFunction(() => SiteCart.count() === 0);
    assert.deepEqual(sent.items, [
      { productId: 'logo-t-shirt', size: 'XS', quantity: 1 },
      { productId: 'flower-keyring', size: '', quantity: 1 },
      { productId: 'slogan-towel', size: '', quantity: 1 },
      { productId: 'sticker-sheet', size: '', quantity: 2 }
    ]);
    await page.unroute('**/api/reservations');
    console.log('PASS keyring, towel and stickers: images, dimensions, filters, single pickups and mixed cart at ₩55,000');

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
    await page.evaluate(() => SiteCart.add({ productId: 'flower-keyring' }));
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
    const boundaries = await page.evaluate(() => {
      return [['2026-09-19', '2026-09-16'], ['2027-01-02', '2026-12-30'], ['2027-03-01', '2027-02-26'], ['2028-03-01', '2028-02-27']].map(([date, lastDay]) => {
        const show = { date, pickup: true };
        return [SiteCatalog.canPickup(show, new Date(`${lastDay}T14:59:59Z`)), SiteCatalog.canPickup(show, new Date(`${lastDay}T15:00:00Z`))];
      });
    });
    assert.deepEqual(boundaries, [[true, false], [true, false], [true, false], [true, false]]);
    await page.clock.setFixedTime(new Date('2026-10-20T14:59:00Z'));
    await go('objects');
    assert.equal(await page.locator('[name="pickup_show"][value="bbang-oct23"]').isEnabled(), true);
    await page.locator('.product-size').first().selectOption('M');
    await page.locator('.reserve-btn').first().click();
    await page.locator('#tray-submit').click();
    await page.clock.setFixedTime(new Date('2026-10-20T15:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    assert.equal(await page.locator('#pickup-application-form [type="submit"]').isDisabled(), true);
    assert.equal(await page.locator('[name="pickup_show"][value="bbang-oct23"]').isDisabled(), true);
    await go('index');
    assert.equal(await page.locator('#home-shows .home-show').count(), 2);
    assert.equal(await page.locator('#home-shows a').count(), 1);
    assert.match(await page.locator('#home-shows .home-show').first().innerText(), /픽업 마감/);
    await go('observations');
    await page.locator('[data-date="2026-10-23"]').click();
    assert.equal(await page.locator('#selected-event a').count(), 0);
    assert.match(await page.locator('#selected-event').innerText(), /픽업 마감/);
    await page.clock.setFixedTime(new Date('2026-10-20T14:59:00Z'));
    await go('cart');
    await page.locator('#open-order').click();
    assert.equal(await page.locator('#order-form [name="showId"]').inputValue(), 'bbang-oct23');
    await page.clock.setFixedTime(new Date('2026-10-20T15:00:00Z'));
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
    console.log('PASS deadlines: inclusive D-3 in Seoul, month/year boundaries, open-tab expiry, closed pickups remain upcoming shows');

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
