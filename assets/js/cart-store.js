(() => {
  // Preserve and migrate selections saved before product IDs and sizes were introduced.
  const KEY = 'sakarin-cosmos-cart-v1';
  let memory = [];
  const key = item => `${item.productId}:${item.size || ''}`;
  function normalize(items) {
    if (!Array.isArray(items)) return [];
    const merged = new Map();
    for (const item of items) {
      if (!item || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 9) continue;
      const product = SiteCatalog.product(item.productId) || SiteCatalog.products.find(product => product.name === item.name);
      if (!product) continue;
      const size = product.sizes.includes(item.size) ? item.size : '';
      const entry = { productId: product.id, name: product.name, unitPrice: product.price,
        price: SiteI18n.currency(product.price), size, quantity: item.quantity };
      const existing = merged.get(key(entry));
      if (existing) existing.quantity = Math.min(9, existing.quantity + entry.quantity);
      else merged.set(key(entry), entry);
    }
    return [...merged.values()];
  }
  function read() {
    let saved;
    try { saved = localStorage.getItem(KEY); } catch { return normalize(memory); }
    try { return normalize(JSON.parse(saved)); } catch { return []; }
  }
  function write(items) {
    memory = normalize(items);
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* Keep this tab usable without storage. */ }
    window.dispatchEvent(new Event('cartchange'));
  }
  window.SiteCart = {
    read, write, key, ready: SiteCatalog.ready,
    add(item) {
      const items = read();
      const [entry] = normalize([{ ...item, quantity: item.quantity || 1 }]);
      if (!entry) return false;
      const found = items.find(saved => key(saved) === key(entry));
      if (found && found.quantity + entry.quantity > 9) return false;
      if (found) found.quantity += entry.quantity;
      else items.push(entry);
      write(items);
      return true;
    },
    setSize(index, size) {
      const items = read(), item = items[index];
      if (!item || (size !== '' && !SiteCatalog.product(item.productId).sizes.includes(size))) return false;
      const match = items.find((entry, position) => position !== index && entry.productId === item.productId && entry.size === size);
      if (match && match.quantity + item.quantity > 9) return false;
      if (match) { match.quantity += item.quantity; items.splice(index, 1); }
      else item.size = size;
      write(items);
      return true;
    },
    removeSubmitted(submitted) {
      const items = read();
      submitted.forEach(sent => {
        const entry = items.find(item => key(item) === key(sent));
        if (entry) entry.quantity -= sent.quantity;
      });
      write(items.filter(item => item.quantity > 0));
    },
    count: () => read().reduce((sum, item) => sum + item.quantity, 0),
    clear: () => write([])
  };
  function updateCount() {
    const count = SiteCart.count();
    document.querySelectorAll('[data-cart-count]').forEach(node => {
      node.textContent = `[${count}]`;
      node.closest('a').setAttribute('aria-label', SiteI18n.t('cart.label', { count }));
    });
  }
  SiteCatalog.ready.then(updateCount);
  window.addEventListener('cartchange', updateCount);
  window.addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) window.dispatchEvent(new Event('cartchange'));
  });
})();
