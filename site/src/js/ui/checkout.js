/** Pieza: checkout. Cinco pasos reales, validados y con pedido de verdad. */
import { formatPrice } from '../catalog.js';
import { state, subscribe, totals, placeOrder } from '../store.js';
import { validateField, cardBrand } from '../validate.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
const STEP_FIELDS = {
  1: ['email', 'name', 'phone'],
  2: ['address', 'city', 'zip', 'country'],
  3: ['holder', 'card', 'expiry', 'cvc', 'age'],
};
const STEP_NAMES = ['Contacto', 'Envío', 'Pago', 'Revisión', 'Confirmación'];
const LAST = 5;
const BRAND_SHORT = { 'American Express': 'Amex' };

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const digits = (v) => String(v || '').replace(/\D/g, '');

/** 4-6-5 en Amex, grupos de 4 en el resto. */
function formatCard(raw) {
  const d = digits(raw).slice(0, 19);
  const groups = cardBrand(d) === 'American Express' ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const out = [];
  let i = 0;
  for (const size of groups) {
    if (i >= d.length) break;
    out.push(d.slice(i, i + size));
    i += size;
  }
  if (i < d.length) out.push(d.slice(i));
  return out.join(' ');
}

function formatExpiry(raw) {
  let d = digits(raw).slice(0, 4);
  if (d.length === 1 && Number(d) > 1) d = `0${d}`;
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** Reformatea conservando el cursor por número de dígitos a su izquierda. */
function reformat(input, formatter) {
  const caret = input.selectionStart;
  const atEnd = caret === null || caret >= input.value.length;
  const before = caret === null ? '' : input.value.slice(0, caret);
  const seen = digits(before).length;
  const next = formatter(input.value);
  if (next === input.value) return;
  input.value = next;
  if (atEnd) return;
  let pos = 0;
  let count = 0;
  while (pos < next.length && count < seen) {
    if (/\d/.test(next[pos])) count += 1;
    pos += 1;
  }
  try { input.setSelectionRange(pos, pos); } catch { /* tipos sin selección */ }
}

const picture = (img, alt, w = 480) => {
  const pic = document.createElement('picture');
  for (const [type, ext] of [['image/avif', 'avif'], ['image/webp', 'webp']]) {
    const s = document.createElement('source');
    s.type = type;
    s.srcset = `/assets/img/${img}-${w}.${ext}`;
    pic.append(s);
  }
  const node = document.createElement('img');
  node.src = `/assets/img/${img}-1200.jpg`;
  node.width = 480;
  node.height = 600;
  node.alt = alt;
  node.loading = 'lazy';
  node.decoding = 'async';
  node.sizes = '54px';
  pic.append(node);
  return pic;
};

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

export function initCheckout() {
  const root = document.getElementById('checkout');
  const panel = document.getElementById('checkout-panel');
  if (!root || !panel) return;

  const main = panel.querySelector('.checkout__main');
  const form = panel.querySelector('[data-checkout-form]');
  const stepsList = panel.querySelector('[data-steps]');
  const stepItems = Array.from(panel.querySelectorAll('[data-step-dot]'));
  const stepPanels = Array.from(panel.querySelectorAll('[data-step-panel]'));
  const live = panel.querySelector('[data-step-live]');
  const foot = panel.querySelector('[data-foot]');
  const prevBtn = panel.querySelector('[data-step-prev]');
  const nextBtn = panel.querySelector('[data-step-next]');
  const placeBtn = panel.querySelector('[data-place-order]');
  const emptyPanel = panel.querySelector('[data-empty-panel]');
  const sumToggle = panel.querySelector('[data-summary-toggle]');
  const sumBody = panel.querySelector('#co-summary');
  const sumLines = panel.querySelector('[data-sum-lines]');
  const cardInput = form.querySelector('[name="card"]');
  const expiryInput = form.querySelector('[name="expiry"]');
  const brandBadge = panel.querySelector('[data-card-brand]');
  const desktop = window.matchMedia('(min-width: 900px)');

  const inputs = new Map();
  for (const list of Object.values(STEP_FIELDS)) {
    for (const name of list) {
      const node = form.querySelector(`[name="${name}"]`);
      if (node) inputs.set(name, node);
    }
  }
  const errorFor = (name) => panel.querySelector(`[data-error="${name}"]`);
  const valueOf = (node) => (node.type === 'checkbox' ? node.checked : node.value);

  let step = 1;
  let open = false;
  let lastFocus = null;
  let lockedByUs = false;
  let lockedY = 0;
  let order = null;
  let placing = false;
  let closeTimer = 0;

  const scrollTop = () => {
    const behavior = reduced() ? 'auto' : 'smooth';
    for (const box of [main, panel.querySelector('.checkout__grid')]) {
      if (box && box.scrollTop > 0) box.scrollTo({ top: 0, behavior });
    }
  };

  /* ------------------------------------------------------------- errores */
  const setError = (name, message) => {
    const node = inputs.get(name);
    const box = errorFor(name);
    if (box) box.textContent = message;
    if (!node) return;
    if (message) node.setAttribute('aria-invalid', 'true');
    else node.removeAttribute('aria-invalid');
  };

  const checkField = (name) => {
    const node = inputs.get(name);
    if (!node) return '';
    const message = validateField(name, valueOf(node));
    setError(name, message);
    return message;
  };

  /** Lleva el foco al primer campo con error y lo deja a la vista, no bajo el pie. */
  const focusInvalid = (node) => {
    node.focus({ preventScroll: true });
    const box = node.closest('.field, .check') || node;
    box.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
  };

  const validateStep = (n) => {
    const names = STEP_FIELDS[n] || [];
    let firstBad = null;
    for (const name of names) {
      const message = checkField(name);
      if (message && !firstBad) firstBad = inputs.get(name);
    }
    return firstBad;
  };

  /* ------------------------------------------------------------- resumen */
  const source = () => (order
    ? { items: order.items, t: order.totals }
    : { items: state.items, t: totals() });

  const paintSummary = () => {
    const { items, t } = source();
    for (const node of panel.querySelectorAll('[data-sum-total]')) node.textContent = formatPrice(t.total);
    for (const node of panel.querySelectorAll('[data-sum-count]')) {
      node.textContent = `${t.units} ${t.units === 1 ? 'artículo' : 'artículos'}`;
    }
    const sub = panel.querySelector('[data-sum-subtotal]');
    if (sub) sub.textContent = formatPrice(t.subtotal);
    const vat = panel.querySelector('[data-sum-vat]');
    if (vat) vat.textContent = formatPrice(t.vat);
    const ship = panel.querySelector('[data-sum-shipping]');
    if (ship) {
      ship.textContent = t.shipping === 0 ? 'Gratis' : formatPrice(t.shipping);
      ship.classList.toggle('sum__free', t.shipping === 0);
    }

    sumLines.textContent = '';
    if (!items.length) {
      const li = el('li', 'sum__empty', 'Todavía no hay ninguna hoja en el pedido.');
      sumLines.append(li);
      return;
    }
    for (const item of items) {
      const li = el('li', 'sum__line');

      const thumb = el('span', 'sum__thumb');
      thumb.append(picture(item.img, ''));
      thumb.append(el('span', 'sum__qty', String(item.qty)));

      const body = el('span', 'sum__body-cell');
      const name = el('span', 'sum__name', item.name);
      const kanji = el('i', null, item.kanji);
      kanji.setAttribute('aria-hidden', 'true');
      name.append(kanji);
      body.append(name, el('span', 'sum__meta', item.summary));
      if (item.engraving) body.append(el('span', 'sum__eng', `Grabado: ${item.engraving}`));

      li.append(thumb, body, el('span', 'sum__price', formatPrice(item.unitPrice * item.qty)));
      sumLines.append(li);
    }
  };

  /* ------------------------------------------------------------- revisión */
  const paintReview = () => {
    const get = (name) => (inputs.get(name) ? String(inputs.get(name).value).trim() : '');
    const fill = (selector, lines) => {
      const box = panel.querySelector(selector);
      if (!box) return;
      box.textContent = '';
      for (const line of lines.filter(Boolean)) box.append(el('span', null, line));
    };
    fill('[data-review-contact]', [get('name'), get('email'), get('phone')]);
    fill('[data-review-shipping]', [
      get('address'),
      [get('zip'), get('city')].filter(Boolean).join(' '),
      get('country'),
    ]);
    const raw = digits(get('card'));
    const brand = cardBrand(raw);
    fill('[data-review-payment]', [
      `${BRAND_SHORT[brand] || brand || 'Tarjeta'} ···· ${raw.slice(-4)}`,
      `Caduca ${get('expiry')} · ${get('holder')}`,
      'Mayor de 18 años confirmado',
    ]);
  };

  /* --------------------------------------------------------------- pasos */
  const paintSteps = () => {
    stepItems.forEach((item) => {
      const n = Number(item.dataset.stepDot);
      item.classList.toggle('is-done', n < step);
      if (n === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    if (live) live.textContent = `Paso ${step} de ${LAST}: ${STEP_NAMES[step - 1]}`;
  };

  const paintFoot = () => {
    const done = step === LAST;
    foot.hidden = done;
    prevBtn.hidden = step === 1 || done;
    nextBtn.hidden = step >= 4;
    placeBtn.hidden = step !== 4;
    nextBtn.textContent = step === 3 ? 'Revisar el pedido' : 'Continuar';
  };

  const setStep = (n, { focus = true } = {}) => {
    step = Math.min(Math.max(n, 1), LAST);
    panel.dataset.step = String(step);
    for (const p of stepPanels) p.hidden = Number(p.dataset.stepPanel) !== step;
    if (step === 4) paintReview();
    paintSteps();
    paintFoot();
    scrollTop();
    if (!focus) return;
    const target = stepPanels.find((p) => Number(p.dataset.stepPanel) === step);
    const heading = target && target.querySelector('h3');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  };

  /* -------------------------------------------------------- estado vacío */
  const applyEmpty = () => {
    const isEmpty = !order && state.items.length === 0;
    emptyPanel.hidden = !isEmpty;
    stepsList.hidden = isEmpty;
    foot.hidden = isEmpty || step === LAST;
    if (isEmpty) for (const p of stepPanels) p.hidden = true;
    else for (const p of stepPanels) p.hidden = Number(p.dataset.stepPanel) !== step;
  };

  /* ------------------------------------------------------ bloqueo scroll */
  const lockScroll = () => {
    if (document.body.classList.contains('is-scroll-locked')) return;
    lockedY = window.scrollY;
    document.body.style.top = `-${lockedY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.classList.add('is-scroll-locked');
    lockedByUs = true;
  };

  const unlockScroll = () => {
    if (!lockedByUs) return;
    lockedByUs = false;
    document.body.classList.remove('is-scroll-locked');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, lockedY);
    html.style.scrollBehavior = prev;
  };

  /* -------------------------------------------------------------- foco */
  const focusables = () => Array.from(panel.querySelectorAll(FOCUSABLE))
    .filter((node) => !node.hasAttribute('hidden') && node.offsetParent !== null);

  const onKeydown = (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeCheckout(); return; }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };

  /* ------------------------------------------------------- abrir/cerrar */
  function openCheckout() {
    if (open) return;
    lastFocus = document.activeElement;
    if (window.KG && window.KG.nav && window.KG.nav.closeMenu) window.KG.nav.closeMenu(false);
    if (window.KG && window.KG.cart && window.KG.cart.close) window.KG.cart.close(false);

    open = true;
    window.clearTimeout(closeTimer);
    if (order) reset();
    root.hidden = false;
    lockScroll();
    applyEmpty();
    paintSummary();
    syncSummary();
    document.addEventListener('keydown', onKeydown);
    panel.setAttribute('tabindex', '-1');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.add('is-open');
      panel.focus({ preventScroll: true });
    }));
  }

  function closeCheckout(restore = true) {
    if (!open) return;
    open = false;
    root.classList.remove('is-open');
    document.removeEventListener('keydown', onKeydown);
    unlockScroll();
    const finish = () => {
      root.hidden = true;
      if (order) reset();
    };
    if (reduced()) finish();
    else closeTimer = window.setTimeout(finish, 420);
    if (restore && lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  function reset() {
    order = null;
    form.reset();
    const country = inputs.get('country');
    if (country) country.value = 'España';
    for (const name of inputs.keys()) setError(name, '');
    if (brandBadge) { brandBadge.hidden = true; brandBadge.textContent = ''; }
    setStep(1, { focus: false });
    applyEmpty();
    paintSummary();
  }

  /* -------------------------------------------------------- confirmación */
  const confirm = () => {
    const bad = [validateStep(1), validateStep(2), validateStep(3)].find(Boolean);
    if (bad) {
      const owner = stepPanels.find((p) => p.contains(bad));
      setStep(Number(owner.dataset.stepPanel), { focus: false });
      focusInvalid(bad);
      return;
    }
    if (!state.items.length) { applyEmpty(); return; }

    const get = (name) => (inputs.get(name) ? String(inputs.get(name).value).trim() : '');
    const raw = digits(get('card'));
    const brand = cardBrand(raw);
    // placeOrder vacía el carrito y avisa a los suscriptores antes de devolver el
    // pedido: sin esta bandera el resumen parpadearía en "carrito vacío".
    placing = true;
    order = placeOrder({
      email: get('email'), name: get('name'), phone: get('phone'),
      address: get('address'), city: get('city'), zip: get('zip'), country: get('country'),
      holder: get('holder'), expiry: get('expiry'),
      card: `···· ${raw.slice(-4)}`, brand: BRAND_SHORT[brand] || brand || 'Tarjeta',
      age: true, demo: true,
    });
    placing = false;
    applyEmpty();

    const refNode = panel.querySelector('[data-conf-ref]');
    if (refNode) refNode.textContent = order.ref;
    const mail = panel.querySelector('[data-conf-email]');
    if (mail) mail.textContent = order.customer.email;
    const eta = panel.querySelector('[data-conf-eta]');
    if (eta) {
      eta.textContent = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date(order.eta));
    }
    const total = panel.querySelector('[data-conf-total]');
    if (total) total.textContent = formatPrice(order.totals.total);

    const list = panel.querySelector('[data-conf-items]');
    if (list) {
      list.textContent = '';
      for (const item of order.items) {
        const li = el('li', 'done__item');
        const name = el('span', 'done__item-name', `${item.qty} × ${item.name}`);
        name.append(el('span', 'done__item-sum', item.engraving ? `${item.summary} · Grabado: ${item.engraving}` : item.summary));
        li.append(name, el('span', 'done__item-price', formatPrice(item.unitPrice * item.qty)));
        list.append(li);
      }
    }

    paintSummary();
    setStep(LAST);
  };

  /* --------------------------------------------------- resumen plegable */
  function syncSummary() {
    if (!sumToggle || !sumBody) return;
    if (desktop.matches) {
      sumToggle.hidden = true;
      sumBody.hidden = false;
      return;
    }
    sumToggle.hidden = false;
    const expanded = sumToggle.getAttribute('aria-expanded') === 'true';
    sumBody.hidden = !expanded;
  }

  if (sumToggle) {
    sumToggle.addEventListener('click', () => {
      const expanded = sumToggle.getAttribute('aria-expanded') === 'true';
      sumToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      syncSummary();
    });
  }
  const onBreakpoint = () => syncSummary();
  if (desktop.addEventListener) desktop.addEventListener('change', onBreakpoint);
  else desktop.addListener(onBreakpoint);

  /* -------------------------------------------------------------- eventos */
  nextBtn.addEventListener('click', () => {
    const bad = validateStep(step);
    if (bad) { focusInvalid(bad); return; }
    setStep(step + 1);
  });
  prevBtn.addEventListener('click', () => setStep(step - 1));
  placeBtn.addEventListener('click', confirm);

  for (const btn of panel.querySelectorAll('[data-step-goto]')) {
    btn.addEventListener('click', () => setStep(Number(btn.dataset.stepGoto)));
  }

  for (const [name, node] of inputs) {
    node.addEventListener('blur', () => {
      const empty = node.type === 'checkbox' ? !node.checked : !node.value.trim();
      if (empty && !node.getAttribute('aria-invalid')) return;
      checkField(name);
    });
    node.addEventListener('input', () => { if (node.getAttribute('aria-invalid')) checkField(name); });
    if (node.type === 'checkbox') node.addEventListener('change', () => checkField(name));
  }

  if (cardInput) {
    cardInput.addEventListener('input', () => {
      reformat(cardInput, formatCard);
      const brand = cardBrand(cardInput.value);
      if (brandBadge) {
        brandBadge.textContent = BRAND_SHORT[brand] || brand;
        brandBadge.hidden = !brand;
      }
    });
  }
  if (expiryInput) expiryInput.addEventListener('input', () => reformat(expiryInput, formatExpiry));

  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const opener = e.target.closest('[data-checkout-open]');
    if (opener) { e.preventDefault(); openCheckout(); return; }
    if (!open) return;
    const closer = e.target.closest('[data-checkout-close]');
    if (closer && root.contains(closer)) closeCheckout();
  });

  subscribe(() => {
    if (order || placing) return;
    paintSummary();
    if (open) applyEmpty();
  });

  setStep(1, { focus: false });
  syncSummary();

  window.KG = window.KG || {};
  window.KG.checkout = { open: openCheckout, close: closeCheckout, isOpen: () => open, step: () => step };
}

export function openCheckout() {
  if (window.KG && window.KG.checkout) window.KG.checkout.open();
}

export function closeCheckout() {
  if (window.KG && window.KG.checkout) window.KG.checkout.close();
}
