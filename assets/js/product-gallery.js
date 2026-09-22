document.querySelectorAll('[data-product-gallery]').forEach(gallery => {
  const track = gallery.querySelector('.product-gallery-track');
  const slides = [...track.querySelectorAll('.product-gallery-slide')];
  const previous = gallery.querySelector('[data-gallery-previous]');
  const next = gallery.querySelector('[data-gallery-next]');
  const count = gallery.querySelector('[data-gallery-count]');
  const caption = gallery.querySelector('[data-gallery-caption]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let destination = null;
  let frame;
  let width = track.getBoundingClientRect().width;
  const clamp = value => Math.max(0, Math.min(slides.length - 1, value));
  function update() {
    count.textContent = `${index + 1} / ${slides.length}`;
    caption.textContent = slides[index].querySelector('img').alt;
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
  }
  function move(value) {
    destination = clamp(value);
    track.scrollTo({ left: destination * width, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
  previous.addEventListener('click', () => move((destination ?? index) - 1));
  next.addEventListener('click', () => move((destination ?? index) + 1));
  track.addEventListener('keydown', event => {
    const position = destination ?? index;
    const targets = { ArrowLeft: position - 1, ArrowRight: position + 1, Home: 0, End: slides.length - 1 };
    if (!(event.key in targets) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    move(targets[event.key]);
  });
  // Native scrolling handles touch gestures, trackpads and keyboard focus.
  ['pointerdown', 'wheel'].forEach(type => track.addEventListener(type, () => { destination = null; }, { passive: true }));
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      // A resize must realign the selected photo before measuring scroll position.
      if (!width || track.getBoundingClientRect().width !== width) return;
      index = clamp(Math.round(track.scrollLeft / width));
      if (destination !== null && Math.abs(track.scrollLeft - destination * width) < 1) destination = null;
      update();
    });
  }, { passive: true });
  new ResizeObserver(() => {
    const nextWidth = track.getBoundingClientRect().width;
    if (!nextWidth || nextWidth === width) return;
    index = destination ?? index;
    destination = null;
    width = nextWidth;
    cancelAnimationFrame(frame);
    track.scrollTo({ left: index * width, behavior: 'instant' });
    update();
  }).observe(track);
  update();
  gallery.querySelector('.product-gallery-controls').hidden = false;
  gallery.dataset.ready = '';
});
