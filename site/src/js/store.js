/** Estado de la tienda: carrito, pedidos y persistencia. Pub/sub minimalista. */
import { PRODUCTS, DEFAULT_VARIANTS, priceOf, productById, describeVariants } from './catalog.js';

const KEY_CART = 'kurogane.cart.v1';
const KEY_ORDERS = 'kurogane.orders.v1';
const SHIPPING_FREE_FROM = 2000;
const SHIPPING_COST = 39;
const VAT_RATE = 0.21;

const listeners = new Set();

const safeParse = (raw, fallback) => {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};

const read = (key, fallback) => {
  try { return safeParse(localStorage.getItem(key), fallback); } catch { return fallback; }
};

const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado */ }
};

export const state = {
  items: read(KEY_CART, []),
  orders: read(KEY_ORDERS, []),
};

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

function emit() {
  write(KEY_CART, state.items);
  write(KEY_ORDERS, state.orders);
  for (const fn of listeners) fn(state);
}

const lineKey = (productId, variants, engraving) =>
  [productId, ...Object.entries(variants).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`), `eng:${(engraving || '').trim()}`].join('|');

export function addItem({ productId, variants = { ...DEFAULT_VARIANTS }, engraving = '', qty = 1 }) {
  const product = productById(productId);
  if (!product) return null;
  const key = lineKey(productId, variants, engraving);
  const existing = state.items.find((i) => i.key === key);
  const unitPrice = priceOf(productId, variants, engraving);
  if (existing) existing.qty = Math.min(existing.qty + qty, 9);
  else {
    state.items.push({
      key, productId, name: product.name, kanji: product.kanji, img: product.img,
      variants: { ...variants }, engraving: engraving.trim(), unitPrice, qty: Math.min(qty, 9),
      summary: describeVariants(variants), lead: product.lead,
    });
  }
  emit();
  return key;
}

export function setQty(key, qty) {
  const item = state.items.find((i) => i.key === key);
  if (!item) return;
  if (qty <= 0) state.items = state.items.filter((i) => i.key !== key);
  else item.qty = Math.min(qty, 9);
  emit();
}

export function removeItem(key) {
  state.items = state.items.filter((i) => i.key !== key);
  emit();
}

export function clearCart() {
  state.items = [];
  emit();
}

export function totals() {
  const subtotal = state.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const units = state.items.reduce((sum, i) => sum + i.qty, 0);
  const shipping = units === 0 || subtotal >= SHIPPING_FREE_FROM ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;
  const vat = Math.round((total - total / (1 + VAT_RATE)) * 100) / 100;
  return { subtotal, shipping, total, vat, units, freeFrom: SHIPPING_FREE_FROM, missingForFree: Math.max(0, SHIPPING_FREE_FROM - subtotal) };
}

export function placeOrder(customer) {
  const t = totals();
  const seq = String(state.orders.length + 1).padStart(3, '0');
  const stamp = new Date();
  const ref = `KG-${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}-${seq}`;
  const order = {
    ref, placedAt: stamp.toISOString(), items: state.items.map((i) => ({ ...i })), totals: t, customer,
    eta: new Date(stamp.getTime() + 1000 * 60 * 60 * 24 * 49).toISOString(),
  };
  state.orders.unshift(order);
  state.items = [];
  emit();
  return order;
}

export { PRODUCTS, SHIPPING_FREE_FROM, SHIPPING_COST };
