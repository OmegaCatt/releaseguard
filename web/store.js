const $ = id => document.getElementById(id);
const token = new URLSearchParams(location.search).get('run');
const suffix = token ? `?run=${encodeURIComponent(token)}` : '';
let products = [];
const money = cents => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(cents / 100);
function item(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; el.textContent = text; return el; }
async function load() {
  const response = await fetch(`/api/store/products${suffix}`), data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Produkty nejsou dostupné.');
  products = data.products;
  const list = $('product-list'), select = $('product'); list.replaceChildren(); select.replaceChildren();
  for (const product of products) {
    const card = item('article', 'product-card'); card.dataset.productId = product.id;
    card.append(item('div', 'product-symbol', product.title.slice(0, 1)), item('h2', '', product.title), item('span', 'product-price', money(product.displayPriceCents)), item('span', 'product-stock', `Skladem ${product.stock} ks`));
    list.append(card);
    const option = item('option', '', product.title); option.value = product.id; select.append(option);
  }
  select.value = products.some(p => p.id === 'luma') ? 'luma' : products[0]?.id ?? '';
}
$('order-form').addEventListener('submit', async event => {
  event.preventDefault(); $('order-error').textContent = ''; $('confirmation').hidden = true;
  const button = $('order-button'); button.disabled = true;
  try {
    const body = { productId: $('product').value, quantity: Number($('quantity').value), email: $('email').value.trim(), idempotencyKey: crypto.randomUUID() };
    const response = await fetch(`/api/store/orders${suffix}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Objednávku se nepodařilo vytvořit.');
    $('confirmation').textContent = `Objednávka #${data.order.id} byla vytvořena. Celkem ${money(data.order.totalCents)}.`;
    $('confirmation').hidden = false;
    await load();
  } catch (error) { $('order-error').textContent = error.message; }
  finally { button.disabled = false; }
});
load().catch(error => { $('product-list').replaceChildren(item('p', 'form-error', error.message)); $('order-button').disabled = true; });
