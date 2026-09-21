(() => {
  const pages = {
    home: '../sakarin_cosmos_home/code.html',
    transmissions: '../sakarin_cosmos_transmissions/code.html',
    archive: '../sakarin_cosmos_archive_media_embeds/code.html',
    objects: '../sakarin_cosmos_objects/code.html',
    observations: '../sakarin_cosmos_observations/code.html',
    info: '../sakarin_cosmos_home/code.html#info',
    contact: 'mailto:hello@sakarincosmos.com',
    'press-kit': '../sakarin_cosmos_archive_media_embeds/code.html',
    'reserve-ledger': '../sakarin_cosmos_cart/code.html'
  };

  const folder = location.pathname.split('/').filter(Boolean).at(-2) || '';
  const current = folder.includes('transmissions') ? 'transmissions'
    : folder.includes('observations') ? 'observations'
    : folder.includes('archive_media') ? 'archive'
    : folder.includes('objects') ? 'objects' : 'transmissions';

  document.querySelectorAll('a[data-path]').forEach((link) => {
    const path = link.dataset.path;
    if (pages[path]) link.href = pages[path];
  });

  document.querySelectorAll('header .material-symbols-outlined').forEach((icon) => {
    if (icon.textContent.trim() === 'person') icon.closest('div')?.remove();
  });

  const brand = document.querySelector('header a.group');
  if (brand) {
    brand.href = pages.home;
    brand.dataset.path = 'home';
    brand.setAttribute('aria-label', 'Sakarin Cosmos home');
  }

  const nav = document.querySelector('header nav');
  if (!nav) return;

  nav.querySelectorAll('a[data-path]').forEach((link) => {
    const active = link.dataset.path === current;
    link.toggleAttribute('aria-current', active);
    link.classList.toggle('text-on-surface', active);
    link.classList.toggle('border-b', active);
    link.classList.toggle('border-primary', active);
    link.classList.toggle('font-medium', active);
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'lg:hidden p-2 text-on-surface border border-outline-variant/50 font-label-code text-label-code';
  button.setAttribute('aria-label', '메뉴 열기');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<span class="material-symbols-outlined text-[20px] block">menu</span>';

  const mobile = nav.cloneNode(true);
  mobile.className = 'hidden lg:hidden absolute left-0 top-16 w-full bg-surface-container-lowest border-t border-outline-variant/30 px-margin-mobile py-space-md flex-col gap-space-sm font-label-code text-label-code tracking-widest';
  mobile.removeAttribute('data-active-classes');
  mobile.querySelectorAll('a').forEach((link) => {
    link.classList.add('block', 'py-2');
    link.addEventListener('click', () => closeMenu());
  });

  const closeMenu = () => {
    mobile.classList.add('hidden');
    mobile.classList.remove('flex');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', '메뉴 열기');
    button.querySelector('span').textContent = 'menu';
  };

  button.addEventListener('click', () => {
    const opening = mobile.classList.contains('hidden');
    mobile.classList.toggle('hidden', !opening);
    mobile.classList.toggle('flex', opening);
    button.setAttribute('aria-expanded', String(opening));
    button.setAttribute('aria-label', opening ? '메뉴 닫기' : '메뉴 열기');
    button.querySelector('span').textContent = opening ? 'close' : 'menu';
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  const headerRow = document.querySelector('header > div');
  const utility = headerRow?.lastElementChild;
  if (headerRow && utility) headerRow.insertBefore(button, utility);
  headerRow?.appendChild(mobile);

  const observationHeading = [...document.querySelectorAll('h2')]
    .find((node) => node.textContent.includes('UPCOMING OBSERVATIONS'));
  observationHeading?.closest('section')?.setAttribute('id', 'observations');
  document.querySelector('footer')?.setAttribute('id', 'info');
})();
