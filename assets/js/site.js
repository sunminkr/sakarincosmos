(() => {
  const { t, href, apply, locale, publishedLocales } = window.SiteI18n;
  const current = document.documentElement.dataset.page;
  const pages = ['transmissions', 'observations', 'archive', 'objects', 'info'];
  const navigation = pages.map(page => `<a data-path="${page}" href="${href(page)}"${page === current ? ' aria-current="page"' : ''}>${t(`nav.${page}`)}</a>`).join('');
  const social = "<a aria-label=\"Instagram\" href=\"https://instagram.com\" rel=\"noopener noreferrer\" target=\"_blank\"><svg stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.75\" viewBox=\"0 0 24 24\"><rect height=\"20\" rx=\"0\" width=\"20\" x=\"2\" y=\"2\"></rect><path d=\"M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z\"></path><line x1=\"17.5\" x2=\"17.51\" y1=\"6.5\" y2=\"6.5\"></line></svg></a><a aria-label=\"YouTube\" href=\"https://youtube.com\" rel=\"noopener noreferrer\" target=\"_blank\"><svg stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.75\" viewBox=\"0 0 24 24\"><path d=\"M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z\"></path><polygon points=\"9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02\"></polygon></svg></a><a aria-label=\"SoundCloud\" href=\"https://soundcloud.com\" rel=\"noopener noreferrer\" target=\"_blank\"><svg stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.75\" viewBox=\"0 0 24 24\"><path d=\"M3 13v3M6 10v6M9 8v8M12 6v10M15 9v7M18 11v5M21 13v3\"></path></svg></a>";
  const languages = publishedLocales.length > 1
    ? `<nav class="site-language" aria-label="${t('language')}">${publishedLocales.map(language => `<a href="${href(current, language)}${location.hash}" lang="${language}" hreflang="${language}"${language === locale ? ' aria-current="true"' : ''}>${language.toUpperCase()}</a>`).join('')}</nav>`
    : '';
  const header = document.querySelector('[data-site-header]');
  header.innerHTML = `
    <div class="site-header-row">
      <a class="site-brand" data-path="home" href="${href('home')}" aria-label="${t('home')}">
        <span class="site-brand-title">SAKARIN COSMOS</span>
        <span class="site-coordinates"><span>✦ RA 05h 35m</span><span>·</span><span>DEC -05°23′</span><span class="site-location">[SEOUL ARCHIVE]</span></span>
      </a>
      <nav class="site-nav" aria-label="${t('navigation')}">${navigation}</nav>
      <div class="site-utility">
        <div class="site-social">${social}</div>
        ${languages}
        <a class="site-cart" data-path="reserve-ledger" href="${href('cart')}" aria-label="${t('cart.label', { count: 0 })}"${current === 'cart' ? ' aria-current="page"' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Z M9 8V6a3 3 0 0 1 6 0v2"/></svg>
          <span class="site-cart-count" data-cart-count aria-hidden="true">[0]</span>
        </a>
        <button class="site-menu-toggle" type="button" aria-label="${t('menu.open')}" aria-expanded="false" aria-controls="mobile-navigation">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
      </div>
    </div>
    <nav id="mobile-navigation" class="site-mobile-nav" aria-label="${t('navigation')}" hidden>${navigation}</nav>`;

  const button = header.querySelector('.site-menu-toggle');
  const mobile = header.querySelector('.site-mobile-nav');
  function setMenu(open, restoreFocus = false) {
    mobile.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', t(open ? 'menu.close' : 'menu.open'));
    button.querySelector('path').setAttribute('d', open ? 'M5 5l14 14M19 5L5 19' : 'M3 6h18M3 12h18M3 18h18');
    if (restoreFocus) button.focus();
  }
  button.addEventListener('click', () => setMenu(mobile.hidden));
  mobile.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobile.hidden) setMenu(false, true);
  });
  document.addEventListener('click', event => { if (!header.contains(event.target)) setMenu(false); });
  header.addEventListener('focusout', event => { if (!header.contains(event.relatedTarget)) setMenu(false); });
  window.matchMedia('(min-width: 1200px)').addEventListener('change', event => {
    if (event.matches) setMenu(false);
  });

  const footer = document.querySelector('[data-site-footer]');
  footer.className = 'site-footer';
  footer.innerHTML = `
    <div class="site-footer-top">
      <div><div class="site-footer-title">SAKARIN COSMOS</div><p class="site-footer-tagline">music keeps a place open.</p></div>
      <div class="site-social">${social}</div>
    </div>
    <div class="site-footer-bottom">
      <div class="site-footer-links"><a data-path="contact" href="${href('contact')}">${t('contact')}</a><span>/</span><a data-path="press-kit" href="${href('press-kit')}">${t('pressKit')}</a><span>/</span><span>SEOUL, KR</span></div>
      <span>COPYRIGHT © SAKARIN COSMOS. ALL RELEASES INDEPENDENT.</span>
    </div>`;
  apply();
  const observationHeading = [...document.querySelectorAll('h2')]
    .find(node => node.textContent.includes('UPCOMING OBSERVATIONS'));
  observationHeading?.closest('section')?.setAttribute('id', 'observations');
})();
