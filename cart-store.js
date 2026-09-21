(() => {
  const KEY = 'sakarin-cosmos-cart-v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const write = items => { localStorage.setItem(KEY, JSON.stringify(items)); window.dispatchEvent(new Event('cartchange')); };
  window.SakarinCart = {
    read, write,
    add(item) {
      const items = read(), found = items.find(entry => entry.name === item.name);
      if (found) found.quantity = Math.min(9, found.quantity + 1);
      else items.push({ name:item.name, price:item.price, quantity:1 });
      write(items);
    },
    count: () => read().reduce((sum, item) => sum + item.quantity, 0),
    clear: () => write([])
  };
  function updateCount() {
    document.querySelectorAll('a[data-path="reserve-ledger"] span:last-child').forEach(node => node.textContent = `[${window.SakarinCart.count()}]`);
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.reserve-btn').forEach(button => button.addEventListener('click', () => {
      window.SakarinCart.add({ name:button.dataset.itemName, price:button.dataset.itemPrice });
    }, true));
    updateCount();
  });
  window.addEventListener('cartchange', updateCount);
})();
