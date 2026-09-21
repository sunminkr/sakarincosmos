(() => {
  const base = new URL('../../', document.currentScript.src);
  const defaultLocale = 'ko';
  const supportedLocales = ['ko', 'en', 'ja'];
  // Publish a locale here only after every page and its content have been translated.
  const publishedLocales = ['ko'];
  const declaredLocale = document.documentElement.lang.split('-')[0];
  const locale = supportedLocales.includes(declaredLocale) ? declaredLocale : defaultLocale;
  const formats = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };
  const routes = {
    home: 'index.html', transmissions: 'transmissions.html',
    observations: 'observations.html', archive: 'archive.html', objects: 'objects.html',
    cart: 'cart.html', 'reserve-ledger': 'cart.html', info: 'index.html#info',
    'press-kit': 'archive.html', contact: 'mailto:hello@sakarincosmos.com'
  };

  function t(key, values = {}) {
    const template = window.SiteMessages[locale]?.[key] ?? window.SiteMessages[defaultLocale]?.[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
  }

  function href(page, language = locale) {
    if (!supportedLocales.includes(language)) language = defaultLocale;
    const route = routes[page] || routes.home;
    if (route.startsWith('mailto:')) return route;
    return new URL(`${language === defaultLocale ? '' : `${language}/`}${route}`, base).href;
  }

  function apply(root = document) {
    const attributes = { 'data-i18n': null, 'data-i18n-label': 'aria-label',
      'data-i18n-placeholder': 'placeholder', 'data-i18n-content': 'content' };
    Object.entries(attributes).forEach(([hook, attribute]) => {
      root.querySelectorAll(`[${hook}]`).forEach(node => {
        const value = t(node.getAttribute(hook));
        if (attribute) node.setAttribute(attribute, value);
        else node.textContent = value;
      });
    });
    root.querySelectorAll('a[data-path]').forEach(link => {
      if (routes[link.dataset.path]) link.href = href(link.dataset.path);
    });
  }

  document.documentElement.lang = locale;
  window.SiteI18n = {
    locale, defaultLocale, supportedLocales, publishedLocales, t, href, apply,
    date: (value, options = {}) => new Intl.DateTimeFormat(formats[locale], options).format(value),
    number: value => new Intl.NumberFormat(formats[locale]).format(value),
    currency: value => new Intl.NumberFormat(formats[locale], {
      style: 'currency', currency: 'KRW', maximumFractionDigits: 0
    }).format(value)
  };
  apply();
})();
