import { initNav } from './ui/nav.js';
import { initCatalog } from './ui/catalog.js';
import { initConfigurator } from './ui/configurator.js';
import { initCart, openCart, closeCart } from './ui/cart.js';
import { initCheckout, openCheckout, closeCheckout } from './ui/checkout.js';
import { initReveal } from './ui/reveal.js';
import { state, totals, addItem, setQty, removeItem, clearCart } from './store.js';
import { PRODUCTS, priceOf, formatPrice } from './catalog.js';

const boot = () => {
  initReveal();
  initNav();
  initCatalog();
  initConfigurator();
  initCart();
  initCheckout();

  // Superficie de control para pruebas automáticas y depuración. No la usa la interfaz.
  window.KG = Object.assign(window.KG || {}, {
    state, totals, addItem, setQty, removeItem, clearCart,
    openCart, closeCart, openCheckout, closeCheckout,
    products: PRODUCTS, priceOf, formatPrice,
    configure: (productId) => document.dispatchEvent(new CustomEvent('kg:configure', { detail: { productId } })),
  });

  document.documentElement.dataset.ready = 'true';
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
