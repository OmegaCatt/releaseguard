import { DatabaseSync } from 'node:sqlite';

export const SCENARIOS = Object.freeze({
  clean: 'Bez závady',
  duplicate: 'Opakovaná objednávka',
  stock: 'Nesoulad skladu',
  validation: 'Chybějící validace',
  price: 'Stará cena na webu',
});

export function createStore(fault = 'clean') {
  if (!Object.hasOwn(SCENARIOS, fault)) throw new Error('Unknown scenario');
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE products (id TEXT PRIMARY KEY, title TEXT NOT NULL, price_cents INTEGER NOT NULL, stock INTEGER NOT NULL);
    CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL, quantity INTEGER NOT NULL, total_cents INTEGER NOT NULL, email TEXT NOT NULL, idempotency_key TEXT NOT NULL);
    INSERT INTO products VALUES
      ('luma', 'Stolní lampa Luma', 129000, 8),
      ('stand', 'Držák monitoru Stand', 89000, 6),
      ('cable', 'Kabel USB-C 2 m', 39000, 12);
  `);
  return { db, fault, close: () => db.close() };
}

export function products(store) {
  return store.db.prepare('SELECT id, title, price_cents AS priceCents, stock FROM products ORDER BY id').all();
}

export function orderById(store, id) {
  return store.db.prepare('SELECT id, product_id AS productId, quantity, total_cents AS totalCents, email FROM orders WHERE id = ?').get(id) ?? null;
}

export function orderCount(store) {
  return store.db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
}

export function placeOrder(store, input) {
  const productId = input?.productId;
  const quantity = input?.quantity;
  const email = input?.email;
  const key = input?.idempotencyKey;
  if (typeof productId !== 'string' || !/^[a-z]{2,20}$/.test(productId) || !Number.isInteger(quantity) || quantity < (store.fault === 'validation' ? 0 : 1) || quantity > 10 || typeof email !== 'string' || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof key !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(key)) {
    return { status: 400, body: { error: 'Neplatné údaje objednávky.' } };
  }
  const db = store.db;
  db.exec('BEGIN IMMEDIATE');
  try {
    if (store.fault !== 'duplicate') {
      const existing = db.prepare('SELECT id FROM orders WHERE idempotency_key = ?').get(key);
      if (existing) {
        const order = orderById(store, existing.id);
        db.exec('COMMIT');
        return { status: 200, body: { order, replayed: true } };
      }
    }
    const product = db.prepare('SELECT id, price_cents AS priceCents, stock FROM products WHERE id = ?').get(productId);
    if (!product) { db.exec('ROLLBACK'); return { status: 404, body: { error: 'Produkt nenalezen.' } }; }
    if (product.stock < quantity) { db.exec('ROLLBACK'); return { status: 409, body: { error: 'Nedostatek kusů skladem.' } }; }
    const result = db.prepare('INSERT INTO orders (product_id, quantity, total_cents, email, idempotency_key) VALUES (?, ?, ?, ?, ?)').run(productId, quantity, product.priceCents * quantity, email, key);
    if (store.fault !== 'stock') db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(quantity, productId);
    const order = orderById(store, Number(result.lastInsertRowid));
    db.exec('COMMIT');
    return { status: 201, body: { order, replayed: false } };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
