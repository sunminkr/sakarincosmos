const assert = require('node:assert/strict');

module.exports = async ({ page, go, noOverflow, shot }) => {
  for (const directory of ['', 'en/', 'jp/']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await go(`${directory}index`);
    assert.equal(await page.locator('#home-products > article').count(), 3);
    assert.equal(await page.locator('#home-archive > article').count(), 3);
    const towel = page.locator('#home-products a[href$="#slogan-towel"] img');
    await towel.scrollIntoViewIfNeeded();
    await page.locator('#home-products .product-gallery-slide:first-child img, #home-products .product-still-photo img')
      .evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await shot(`${directory.slice(0, -1) || 'ko'}-home-products-desktop`);

    await go(`${directory}objects`);
    for (const width of [768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('#catalog-grid').scrollIntoViewIfNeeded();
      const measurements = () => page.locator('#catalog-grid > article').evaluateAll(cards => cards.map(card => {
        const box = card.getBoundingClientRect();
        const body = card.querySelector('.reserve-btn').parentElement.parentElement;
        const actions = body.lastElementChild.getBoundingClientRect();
        const description = body.firstElementChild.getBoundingClientRect();
        return { top: box.top + scrollY, height: box.height,
          buttonTop: card.querySelector('.reserve-btn').getBoundingClientRect().top + scrollY,
          gap: actions.top - description.bottom };
      }));
      const before = await measurements();
      const neighbors = before.map((card, i) => i > 0 && Math.abs(card.top - before[0].top) < 1 ? i : -1).filter(i => i > 0);
      assert.equal(neighbors.length, width === 768 ? 1 : 2);
      for (const i of neighbors) assert.ok(before[i].gap <= 24, 'Product actions follow the description without stretched spacing');
      await page.locator('.product-size-guide summary').click();
      const after = await measurements();
      assert.ok(after[0].height > before[0].height + 150, 'Size guide actually expands');
      for (const i of neighbors) {
        assert.ok(Math.abs(after[i].buttonTop - before[i].buttonTop) < 1, 'Other pickup buttons stay in place');
        assert.ok(Math.abs(after[i].height - before[i].height) < 1, 'Other cards keep their own height');
      }
      await noOverflow(`expanded size guide ${directory} ${width}px`);
      if (width === 1440) {
        await page.locator('#catalog-grid').evaluate(el => el.scrollIntoView({ block: 'start' }));
        await shot(`${directory.slice(0, -1) || 'ko'}-objects-guide-desktop`);
      }
      await page.locator('.product-size-guide summary').click();
    }
    await page.locator('#confirm-intent-btn').click();
    let mobileHeight;
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await noOverflow(`pickup instructions ${directory} ${width}px`);
      const dimensions = await page.locator('.pickup-steps p').first().evaluate(el => {
        const parent = el.parentElement;
        const available = parent.clientWidth - parseFloat(getComputedStyle(parent).paddingLeft);
        return { width: el.getBoundingClientRect().width, available, height: el.getBoundingClientRect().height };
      });
      assert.ok(Math.abs(dimensions.width - dimensions.available) < 1, 'Instructions use the available screen width');
      if (width === 320) mobileHeight = dimensions.height;
      if (width === 1440) assert.ok(dimensions.height < mobileHeight, 'Instruction lines reflow as the screen widens');
      if (width === 390) {
        await page.locator('#pickup-instructions').evaluate(el => el.scrollIntoView({ block: 'start' }));
        await shot(`${directory.slice(0, -1) || 'ko'}-pickup-instructions-reflow`);
      }
    }
  }
  console.log('PASS Objects layout: three home cards, independent product heights, stationary sibling buttons, fluid instructions in all languages');
};
