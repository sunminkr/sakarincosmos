const assert = require('node:assert/strict');

module.exports = async ({ page, context, go, noOverflow, shot }) => {
  const gallery = page.locator('[data-product-gallery]');
  const track = gallery.locator('.product-gallery-track');
  const previous = gallery.locator('[data-gallery-previous]');
  const next = gallery.locator('[data-gallery-next]');
  const at = async index => {
    await page.waitForFunction(index => {
      const track = document.querySelector('.product-gallery-track');
      return Math.abs(track.scrollLeft - index * track.getBoundingClientRect().width) < 1
        && document.querySelector('[data-gallery-count]').textContent === `${index + 1} / 3`;
    }, index);
    const image = gallery.locator('img').nth(index);
    await image.evaluate(image => image.decode());
    assert.equal(await gallery.locator('[data-gallery-caption]').textContent(), await image.getAttribute('alt'));
  };
  for (const directory of ['', 'en/', 'jp/']) {
    for (const name of ['index', 'objects']) {
      await page.setViewportSize({ width: 390, height: 844 });
      await go(`${directory}${name}`);
      await gallery.scrollIntoViewIfNeeded();
      assert.equal(await gallery.locator('img').count(), 3);
      assert.equal(await gallery.locator('img').evaluateAll(images => images.filter(image => image.closest('details')).length), 0);
      assert.equal(await next.getAttribute('aria-label'), await page.evaluate(() => SiteI18n.t('objects.photos.next')));
      await at(0);
      assert.equal(await previous.isDisabled(), true);
      await next.click();
      await at(1);
      await shot(`gallery-${directory ? directory.slice(0, -1) : 'ko'}-${name}-mobile`);
      await next.click();
      await at(2);
      assert.equal(await next.isDisabled(), true);
      await previous.click();
      await at(1);
      await track.focus();
      await page.keyboard.press('Home');
      await at(0);
      await page.keyboard.press('End');
      await at(2);
      await page.keyboard.press('ArrowLeft');
      await at(1);
      await page.keyboard.press('ArrowRight');
      await at(2);
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await at(2);
        await noOverflow(`gallery ${directory}${name} ${width}px`);
      }
      assert.match(await gallery.locator('a').last().getAttribute('href'), /worn\.png$/);
    }
  }
  // Exercise a real touch gesture so swiping neither navigates nor opens a photo.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await go('objects');
  await track.scrollIntoViewIfNeeded();
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const box = await track.boundingBox();
  const x = box.x + box.width * .85;
  const y = box.y + box.height / 2;
  const url = page.url();
  const tabs = context.pages().length;
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - box.width * .7 * step / 8, y }] });
      await page.waitForTimeout(30);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await at(1);
    assert.equal(page.url(), url);
    assert.equal(context.pages().length, tabs);
    await next.click();
    await at(2);
  } finally {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await session.detach();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  console.log('PASS product galleries: three photos on both pages in all languages, arrows, keyboard, touch swipe, resize and reduced motion');
};
