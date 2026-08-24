/** Pieza: configurator. Estado del encargo → escenario, precio en vivo y URL.
 *  El HTML ya trae el estado por defecto (Mumei, todas las opciones de delta 0),
 *  así que al hidratar no se mueve nada: solo se reconcilia lo que cambie. */

import {
  OPTION_GROUPS, DEFAULT_VARIANTS, ENGRAVING_PRICE,
  priceOf, formatPrice, describeVariants, productById, optionById,
} from '../catalog.js';
import { addItem } from '../store.js';

/* param de la URL → grupo de opciones */
const URL_KEYS = { hoja: 'blade', filo: 'edge', tsuba: 'tsuba', saya: 'saya' };
const GROUP_KEYS = Object.fromEntries(Object.entries(URL_KEYS).map(([k, g]) => [g, k]));

/* alt real de cada foto de producto (site/src/static/img/inventory.json) */
const ALT = {
  mumei: 'Katana Mumei con su montura sobre fondo claro.',
  kurogane: 'Katana Kurogane montada, con empuñadura trenzada y saya oscura.',
  hanabira: 'Katana Hanabira con koshirae completo y hoja pulida.',
  arashi: 'Katana Arashi: hoja de acero plegado con su montura.',
  tsuki: 'Hoja de la katana Tsuki sobre fondo negro, con el filo iluminado de punta a punta.',
  ryujin: 'Hoja Ryūjin con un dragón grabado a buril sobre el acero.',
};

const MAX_ENGRAVING = 12;
const IMG_WIDTHS = [480, 800, 1200];

const srcsetFor = (name, ext) =>
  IMG_WIDTHS.map((w) => `/assets/img/${name}-${w}.${ext} ${w}w`).join(', ');

export function initConfigurator() {
  const root = document.getElementById('configurador');
  if (!root) return;

  /* ------------------------------------------------------------- nodos */
  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => Array.from(root.querySelectorAll(sel));

  const frame = q('.cfg__hero-frame');
  const img = q('[data-config-img]');
  const srcAvif = q('[data-config-src="avif"]');
  const srcWebp = q('[data-config-src="webp"]');
  const elKanji = q('[data-config-kanji]');
  const elName = q('[data-config-name]');
  const elClaim = q('[data-config-claim]');
  const elSteel = q('[data-config-steel]');
  const elHamon = q('[data-config-hamon]');
  const elNagasa = q('[data-config-nagasa]');
  const elLead = q('[data-config-lead]');
  const elLeadShort = q('[data-config-lead-short]');
  const elTotal = q('[data-config-total]');
  const elSummary = q('[data-config-summary]');
  const elModelName = q('[data-config-model-name]');
  const elLive = q('[data-config-live]');
  const engInput = q('[data-engraving]');
  const engCount = q('[data-engraving-count]');
  const engWrap = q('.cfg__eng');
  const addBtn = q('[data-add-to-cart]');

  const modelBtns = qa('[data-model]');
  const optionBtns = qa('[data-option]');
  const groups = qa('.cfg__group[role="group"]');

  /* ------------------------------------------------------------- estado */
  const fallbackId = root.dataset.product || 'mumei';

  const state = {
    productId: productById(fallbackId) ? fallbackId : 'mumei',
    variants: { ...DEFAULT_VARIANTS },
    engraving: '',
  };

  let touched = false;   // no reescribimos la URL hasta que alguien toque algo
  let booted = false;
  let liveTimer = 0;
  let swapTimer = 0;

  /* ------------------------------------------------------- URL de entrada */
  const readUrl = () => {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch { return; }
    const modelo = params.get('modelo');
    if (modelo && productById(modelo)) state.productId = modelo;
    for (const [key, group] of Object.entries(URL_KEYS)) {
      const value = params.get(key);
      if (value && optionById(group, value)) state.variants[group] = value;
    }
  };

  const writeUrl = () => {
    if (!touched || !window.history || !window.history.replaceState) return;
    let url;
    try { url = new URL(window.location.href); } catch { return; }
    url.searchParams.set('modelo', state.productId);
    for (const [group, key] of Object.entries(GROUP_KEYS)) {
      url.searchParams.set(key, state.variants[group]);
    }
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };

  /* --------------------------------------------------------- escenario */
  const paintImage = (product) => {
    if (!img) return;
    const jpg = `/assets/img/${product.img}-1200.jpg`;
    if (img.getAttribute('src') === jpg) return;

    // Durante la transición de vista el cambio de modelo ocurre fuera de
    // pantalla y la foto la anima el navegador: aquí no hay nada que fundir.
    if (frame && !document.documentElement.hasAttribute('data-morphing')) {
      frame.classList.add('is-swapping');
      clearTimeout(swapTimer);
      swapTimer = setTimeout(() => frame.classList.remove('is-swapping'), 900);
    }
    if (srcAvif) srcAvif.srcset = srcsetFor(product.img, 'avif');
    if (srcWebp) srcWebp.srcset = srcsetFor(product.img, 'webp');
    img.setAttribute('src', jpg);
    img.setAttribute('alt', ALT[product.id] || `Katana ${product.name} con su montura.`);

    const settle = () => {
      clearTimeout(swapTimer);
      if (frame) frame.classList.remove('is-swapping');
    };
    if (img.decode) img.decode().then(settle, settle);
    else img.addEventListener('load', settle, { once: true });
  };

  const paintMounts = () => {
    for (const group of ['edge', 'tsuba', 'saya']) {
      const opt = optionById(group, state.variants[group]);
      if (!opt) continue;
      const label = q(`[data-mount="${group}"]`);
      const swatch = q(`[data-mount-swatch="${group}"]`);
      if (label) label.textContent = opt.label;
      if (swatch && opt.swatch) swatch.style.setProperty('--sw', opt.swatch);
    }
  };

  /* ------------------------------------------------------------- precio */
  let lastTotal = null;

  const paintPrice = (product) => {
    const total = priceOf(state.productId, state.variants, state.engraving);
    if (!elTotal) return total;
    elTotal.textContent = formatPrice(total);
    if (lastTotal !== null && total !== lastTotal) {
      elTotal.classList.remove('is-bump');
      void elTotal.offsetWidth;
      elTotal.classList.add('is-bump');
      setTimeout(() => elTotal.classList.remove('is-bump'), 280);
    }
    lastTotal = total;
    if (addBtn) {
      addBtn.dataset.product = state.productId;
      addBtn.setAttribute(
        'aria-label',
        `Añadir al carrito: ${product.name}, ${describeVariants(state.variants)}, ${formatPrice(total)}`,
      );
    }
    return total;
  };

  const announce = (product, total) => {
    if (!elLive || !booted) return;   // al hidratar no se anuncia nada
    clearTimeout(liveTimer);
    const eng = state.engraving.trim() ? `, grabado «${state.engraving.trim()}»` : '';
    liveTimer = setTimeout(() => {
      elLive.textContent = `${product.name}: ${describeVariants(state.variants)}${eng}. Total ${formatPrice(total)}.`;
    }, 420);
  };

  /* -------------------------------------------------------------- pintar */
  const paintPressed = (buttons, isOn) => {
    for (const btn of buttons) {
      const on = isOn(btn);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    }
  };

  const render = () => {
    const product = productById(state.productId);
    if (!product) return;

    root.dataset.product = product.id;

    paintPressed(modelBtns, (b) => b.dataset.model === product.id);
    paintPressed(optionBtns, (b) => state.variants[b.dataset.group] === b.dataset.value);

    paintImage(product);
    paintMounts();

    if (elKanji) elKanji.textContent = product.kanji;
    if (elName) elName.textContent = product.name;
    if (elClaim) elClaim.textContent = product.claim;
    if (elSteel) elSteel.textContent = product.steel;
    if (elHamon) elHamon.textContent = product.hamon;
    if (elLead) elLead.textContent = product.lead;
    if (elLeadShort) elLeadShort.textContent = product.lead;

    const blade = optionById('blade', state.variants.blade);
    if (elNagasa && blade) elNagasa.textContent = blade.label;

    if (elModelName) elModelName.textContent = product.name;
    if (elSummary) elSummary.textContent = describeVariants(state.variants);

    if (engWrap) engWrap.classList.toggle('is-on', state.engraving.trim().length > 0);
    if (engCount) engCount.textContent = `${state.engraving.length}/${MAX_ENGRAVING}`;

    const total = paintPrice(product);
    announce(product, total);
    writeUrl();
  };

  /* ------------------------------------------------------------ cambios */
  const setModel = (id, { silent = false } = {}) => {
    if (!productById(id) || id === state.productId) return;
    state.productId = id;
    touched = true;
    render();
    if (!silent) {
      document.dispatchEvent(new CustomEvent('kg:model', { detail: { productId: id } }));
    }
  };

  const setOption = (group, value) => {
    if (!optionById(group, value) || state.variants[group] === value) return;
    state.variants[group] = value;
    touched = true;
    render();
  };

  root.addEventListener('click', (event) => {
    const model = event.target.closest('[data-model]');
    if (model && root.contains(model)) { setModel(model.dataset.model); return; }
    const option = event.target.closest('[data-option]');
    if (option && root.contains(option)) setOption(option.dataset.group, option.dataset.value);
  });

  /* --- teclado: flechas dentro de cada grupo, como un grupo de radios ---- */
  for (const group of groups) {
    group.addEventListener('keydown', (event) => {
      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      const items = Array.from(group.querySelectorAll('[data-option], [data-model]'));
      const current = items.indexOf(event.target.closest('[data-option], [data-model]'));
      if (current < 0) return;
      event.preventDefault();
      let next = current;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % items.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
      else if (event.key === 'Home') next = 0;
      else next = items.length - 1;

      const btn = items[next];
      if (btn.dataset.model) setModel(btn.dataset.model);
      else setOption(btn.dataset.group, btn.dataset.value);
      btn.focus();
    });
  }

  /* ------------------------------------------------------------ grabado */
  if (engInput) {
    engInput.addEventListener('input', () => {
      const clean = engInput.value.replace(/\s+/g, ' ').slice(0, MAX_ENGRAVING);
      if (clean !== engInput.value) engInput.value = clean;
      state.engraving = clean;
      touched = true;
      render();
    });
  }

  /* ------------------------------------------------------ añadir al carrito */
  const openCart = () => {
    const cart = window.KG && window.KG.cart;
    if (cart && typeof cart.open === 'function') { cart.open(); return; }
    const trigger = document.querySelector('[data-cart-open]');
    if (trigger) trigger.click();
  };

  if (addBtn) {
    const idleLabel = addBtn.textContent.trim();
    let revert = 0;
    addBtn.addEventListener('click', () => {
      const product = productById(state.productId);
      if (!product) return;
      addItem({
        productId: state.productId,
        variants: { ...state.variants },
        engraving: state.engraving,
      });
      if (elLive) {
        clearTimeout(liveTimer);
        elLive.textContent = `${product.name} añadida al carrito: ${describeVariants(state.variants)}.`;
      }
      addBtn.textContent = 'Añadida';
      clearTimeout(revert);
      revert = setTimeout(() => { addBtn.textContent = idleLabel; }, 1800);
      openCart();
    });
  }

  /* ------------------------------------- llamada desde el catálogo */
  document.addEventListener('kg:configure', (event) => {
    const id = event.detail && event.detail.productId;
    if (!id || !productById(id)) return;
    setModel(id);
  });

  /* --------------------------------------------------------------- arranque */
  readUrl();
  if (engInput && engInput.value) state.engraving = engInput.value.slice(0, MAX_ENGRAVING);
  render();
  booted = true;

  window.KG = window.KG || {};
  window.KG.configurator = {
    get state() { return { productId: state.productId, variants: { ...state.variants }, engraving: state.engraving }; },
    setModel,
    setOption,
    price: () => priceOf(state.productId, state.variants, state.engraving),
    groups: OPTION_GROUPS.map((g) => g.id),
    engravingPrice: ENGRAVING_PRICE,
  };
}
