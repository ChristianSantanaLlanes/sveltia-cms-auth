/** Pieza: cart. Panel lateral con líneas, cantidades, envío y totales. */
import { subscribe, setQty, removeItem, state, totals } from '../store.js';
import { formatPrice } from '../catalog.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
const MAX_QTY = 9;

let openCartFn = () => {};
let closeCartFn = () => {};

/** Abre el carrito. `trigger` es el elemento al que se devuelve el foco. */
export function openCart(trigger) { openCartFn(trigger); }

/** Cierra el carrito. Con `restore = false` no devuelve el foco al disparador. */
export function closeCart(restore = true) { closeCartFn(restore); }

export function initCart() {
  const root = document.querySelector('[data-cart]');
  if (!root) return;

  const panel = root.querySelector('#cart-panel');
  const list = root.querySelector('[data-cart-lines]');
  const empty = root.querySelector('[data-cart-empty]');
  const tpl = root.querySelector('[data-cart-line-template]');
  const scroll = root.querySelector('[data-cart-scroll]');
  const foot = root.querySelector('[data-cart-foot]');
  const live = root.querySelector('[data-cart-live]');
  const closeBtn = root.querySelector('.cart__close');
  const checkoutBtn = root.querySelector('[data-checkout-open]');

  const unitsEl = root.querySelector('[data-cart-units]');
  const shipBox = root.querySelector('[data-cart-ship]');
  const shipNote = root.querySelector('[data-cart-ship-note]');
  const shipFill = root.querySelector('[data-cart-ship-fill]');
  const subtotalEl = root.querySelector('[data-cart-subtotal]');
  const shippingEl = root.querySelector('[data-cart-shipping]');
  const vatEl = root.querySelector('[data-cart-vat]');
  const totalEl = root.querySelector('[data-cart-total]');

  if (!panel || !list || !tpl) return;

  root.hidden = false;

  /* ------------------------------------------------------------- líneas */
  const nodes = new Map(); // key -> <li>

  const buildLine = (item) => {
    const li = tpl.content.firstElementChild.cloneNode(true);
    const q = (sel) => li.querySelector(sel);

    const avif = q('[data-src-avif]');
    const webp = q('[data-src-webp]');
    const img = q('[data-src-jpg]');
    avif.srcset = `/assets/img/${item.img}-480.avif`;
    webp.srcset = `/assets/img/${item.img}-480.webp`;
    img.src = `/assets/img/${item.img}-1200.jpg`;
    img.alt = `Katana ${item.name}`;

    q('[data-line-name]').textContent = item.name;
    q('[data-line-kanji]').textContent = item.kanji;

    const dec = q('[data-qty-dec]');
    const inc = q('[data-qty-inc]');
    const rm = q('[data-remove]');
    for (const b of [dec, inc, rm]) b.dataset.key = item.key;
    q('[data-qty]').setAttribute('aria-label', `Unidades de ${item.name}`);
    dec.setAttribute('aria-label', `Quitar una unidad de ${item.name}`);
    inc.setAttribute('aria-label', `Añadir una unidad de ${item.name}`);
    rm.setAttribute('aria-label', `Quitar ${item.name} del carrito`);

    nodes.set(item.key, li);
    return li;
  };

  const paintLine = (li, item) => {
    const q = (sel) => li.querySelector(sel);
    q('[data-line-summary]').textContent = item.summary;

    const eng = q('[data-line-eng]');
    if (item.engraving) {
      q('[data-line-eng-text]').textContent = item.engraving;
      eng.hidden = false;
    } else {
      eng.hidden = true;
    }

    q('[data-line-lead]').textContent = `Sale del taller en ${item.lead}`;
    q('[data-line-qty]').textContent = String(item.qty);
    q('[data-line-amount]').textContent = formatPrice(item.unitPrice * item.qty);
    q('[data-line-unit]').textContent =
      item.qty > 1 ? `${formatPrice(item.unitPrice)} × ${item.qty}` : '';

    const dec = q('[data-qty-dec]');
    const inc = q('[data-qty-inc]');
    dec.disabled = item.qty <= 1;
    inc.disabled = item.qty >= MAX_QTY;
    inc.title = item.qty >= MAX_QTY ? `Máximo ${MAX_QTY} unidades por pedido` : '';
  };

  const renderLines = (items) => {
    items.forEach((item, i) => {
      const li = nodes.get(item.key) || buildLine(item);
      paintLine(li, item);
      if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
    });

    const alive = new Set(items.map((i) => i.key));
    for (const [key, li] of nodes) {
      if (alive.has(key)) continue;
      const hadFocus = li.contains(document.activeElement);
      li.remove();
      nodes.delete(key);
      if (hadFocus) refocus();
    }
  };

  const refocus = () => {
    const next = list.querySelector('[data-remove]');
    if (next) next.focus();
    else if (closeBtn) closeBtn.focus();
    else panel.focus();
  };

  /* ------------------------------------------------------------- totales */
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const renderTotals = () => {
    const t = totals();
    const has = t.units > 0;

    unitsEl.textContent = has ? plural(t.units, 'pieza', 'piezas') : 'Sin piezas';
    empty.hidden = has;
    list.hidden = !has;
    foot.hidden = !has;
    if (checkoutBtn) checkoutBtn.disabled = !has;

    subtotalEl.textContent = formatPrice(t.subtotal);
    shippingEl.textContent = t.shipping === 0 ? 'Gratis' : formatPrice(t.shipping);
    vatEl.textContent = formatPrice(t.vat);
    totalEl.textContent = formatPrice(t.total);

    shipBox.hidden = !has;
    if (has) {
      const free = t.missingForFree === 0;
      shipBox.classList.toggle('is-free', free);
      shipNote.textContent = '';
      if (free) {
        shipNote.append('Envío asegurado y despacho de aduanas ');
        const b = document.createElement('b');
        b.textContent = 'incluidos';
        shipNote.append(b, '.');
      } else {
        shipNote.append('Te faltan ');
        const b = document.createElement('b');
        b.textContent = formatPrice(t.missingForFree);
        shipNote.append(b, ' para el envío gratuito.');
      }
      shipFill.style.setProperty('--p', String(Math.min(1, t.subtotal / t.freeFrom).toFixed(4)));
    }
    return t;
  };

  /* ------------------------------------------------- suscripción a la tienda */
  let first = true;
  let lastKeys = '';

  subscribe((s) => {
    renderLines(s.items);
    const t = renderTotals();

    const keys = s.items.map((i) => `${i.key}:${i.qty}`).join(',');
    if (!first && keys !== lastKeys && live) {
      live.textContent = t.units === 0
        ? 'El carrito está vacío.'
        : `${plural(t.units, 'pieza', 'piezas')} en el carrito. Total ${formatPrice(t.total)}.`;
    }
    lastKeys = keys;
    first = false;
  });

  /* --------------------------------------------------- cantidades y borrado */
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-qty-inc], [data-qty-dec], [data-remove]');
    if (!btn || !panel.contains(btn)) return;
    const key = btn.dataset.key;
    const item = state.items.find((i) => i.key === key);
    if (!item) return;

    if (btn.hasAttribute('data-remove')) {
      removeItem(key);
      if (live) {
        live.textContent = state.items.length
          ? `${item.name} fuera del carrito. ${plural(totals().units, 'pieza', 'piezas')}, ${formatPrice(totals().total)}.`
          : `${item.name} fuera del carrito. El carrito está vacío.`;
      }
      return;
    }
    const delta = btn.hasAttribute('data-qty-inc') ? 1 : -1;
    const next = Math.min(MAX_QTY, Math.max(1, item.qty + delta));
    if (next !== item.qty) setQty(key, next);
    if (next >= MAX_QTY && delta > 0 && live) live.textContent = `Máximo ${MAX_QTY} unidades por pedido.`;
  });

  /* ------------------------------------------------- apertura y cierre */
  let open = false;
  let lastFocus = null;
  let lockedY = 0;

  const lock = () => {
    if (document.body.classList.contains('is-cart-locked')) return;
    lockedY = window.scrollY;
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--sbw', `${Math.max(0, sbw)}px`);
    document.body.style.top = `-${lockedY}px`;
    document.body.classList.add('is-cart-locked');
  };

  const unlock = () => {
    if (!document.body.classList.contains('is-cart-locked')) return;
    document.body.classList.remove('is-cart-locked');
    document.body.style.top = '';
    document.documentElement.style.removeProperty('--sbw');
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, lockedY);
    html.style.scrollBehavior = prev;
  };

  const focusables = () =>
    Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
      (el) => !el.disabled && el.getClientRects().length > 0,
    );

  const onKeydown = (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); doClose(true); return; }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) { e.preventDefault(); panel.focus(); return; }
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    const active = document.activeElement;
    if (!panel.contains(active)) { e.preventDefault(); (e.shiftKey ? lastEl : firstEl).focus(); return; }
    if (e.shiftKey && active === firstEl) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && active === lastEl) { e.preventDefault(); firstEl.focus(); }
  };

  function doOpen(trigger) {
    if (open) return;
    open = true;
    lastFocus = trigger || document.activeElement;
    root.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    lock();
    if (scroll) scroll.scrollTop = 0;
    document.addEventListener('keydown', onKeydown);
    requestAnimationFrame(() => (closeBtn || panel).focus());
  }

  function doClose(restore = true) {
    if (!open) return;
    open = false;
    root.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKeydown);
    unlock();
    if (restore && lastFocus && document.contains(lastFocus) && lastFocus.getClientRects().length) lastFocus.focus();
    lastFocus = null;
  }

  openCartFn = doOpen;
  closeCartFn = doClose;

  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-cart-open]');
    if (opener) {
      e.preventDefault();
      doOpen(opener);
      return;
    }
    const closer = e.target.closest('[data-cart-close]');
    if (closer && root.contains(closer)) {
      // Los enlaces del estado vacío llevan a una sección: cierran sin recuperar el foco.
      doClose(closer.tagName !== 'A');
    }
  });

  // El checkout abre solo (escucha [data-checkout-open]): aquí solo se cede el panel
  // y se devuelve el foco al disparador original, para que el checkout lo herede vivo.
  if (checkoutBtn) checkoutBtn.addEventListener('click', () => doClose(true));

  window.KG = window.KG || {};
  window.KG.cart = { open: doOpen, close: doClose, isOpen: () => open };
}
