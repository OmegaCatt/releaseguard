import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, orderCount, placeOrder, products } from '../store.mjs';

const input = (key = 'unique-key-001', quantity = 2) => ({ productId: 'luma', quantity, email: 'demo@example.test', idempotencyKey: key });
function withStore(fault, fn) { const store = createStore(fault); try { fn(store); } finally { store.close(); } }

test('baseline purchase is atomic, priced in cents and decrements stock', () => withStore('clean', store => {
  const result = placeOrder(store, input());
  assert.equal(result.status, 201);
  assert.equal(result.body.order.totalCents, 258000);
  assert.equal(orderCount(store), 1);
  assert.equal(products(store).find(p => p.id === 'luma').stock, 6);
}));

test('same idempotency key returns original order without second stock decrement', () => withStore('clean', store => {
  const first = placeOrder(store, input()), second = placeOrder(store, input());
  assert.equal(second.status, 200);
  assert.equal(second.body.order.id, first.body.order.id);
  assert.equal(orderCount(store), 1);
  assert.equal(products(store).find(p => p.id === 'luma').stock, 6);
}));

test('invalid quantity, email and idempotency key are rejected without writes', () => withStore('clean', store => {
  for (const bad of [{ ...input(), quantity: 0 }, { ...input(), quantity: 1.5 }, { ...input(), email: 'wrong' }, { ...input(), idempotencyKey: 'x' }]) assert.equal(placeOrder(store, bad).status, 400);
  assert.equal(orderCount(store), 0);
}));

test('out-of-stock request rolls back without a phantom order', () => withStore('clean', store => {
  assert.equal(placeOrder(store, input('overstock-001', 9)).status, 409);
  assert.equal(orderCount(store), 0);
  assert.equal(products(store).find(p => p.id === 'luma').stock, 8);
}));

test('injected faults produce real observable differences', () => {
  withStore('duplicate', store => { placeOrder(store, input()); placeOrder(store, input()); assert.equal(orderCount(store), 2); });
  withStore('stock', store => { placeOrder(store, input()); assert.equal(products(store).find(p => p.id === 'luma').stock, 8); });
  withStore('validation', store => { assert.equal(placeOrder(store, input('zero-qty-001', 0)).status, 201); });
});
