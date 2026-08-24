/** Pieza: catalog. Filtro por trazo del temple y salto al configurador.
 *  Las seis tarjetas están escritas en el HTML: aquí no se pinta ninguna,
 *  solo se ocultan, se cuentan y se conectan con el configurador. */
import { PRODUCTS } from '../catalog.js';
import { canMorph, morphToDetail } from '../transition.js';

/** Familias de hamon: agrupan los cinco trazos del catálogo en tres lecturas. */
const FAMILIES = [
  { id: 'recto', test: /suguha/i },
  { id: 'ondulado', test: /notare|gunome/i },
  { id: 'florido', test: /ch[oō]ji|hitatsura|midare/i },
];

/** El trazo manda sobre el orden: gunome-midare es ondulado, no florido. */
const familyOf = (hamon = '') => (FAMILIES.find((f) => f.test.test(hamon)) || {}).id || 'otro';

const FAMILY_BY_PRODUCT = Object.fromEntries(PRODUCTS.map((p) => [p.id, familyOf(p.hamon)]));

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initCatalog() {
  const root = document.getElementById('catalogo');
  if (!root) return;

  const cells = Array.from(root.querySelectorAll('.catalog__cell'));
  const total = cells.length;

  /* ------------------------------------------------------------- filtro */
  const controls = root.querySelector('[data-catalog-controls]');
  const chips = Array.from(root.querySelectorAll('[data-filter]'));
  const countEl = root.querySelector('[data-catalog-count]');
  let active = 'all';

  // El filtro solo existe con JS: hasta aquí no había nada que pulsar.
  if (controls && chips.length) controls.hidden = false;

  const setCount = (shown) => {
    if (!countEl) return;
    const word = shown === 1 ? 'modelo' : 'modelos';
    countEl.textContent = active === 'all' ? `${total} ${word}` : `${shown} de ${total} ${word}`;
  };

  const apply = (value, { animate = true } = {}) => {
    active = value;
    let shown = 0;

    for (const cell of cells) {
      const card = cell.querySelector('[data-product-card]');
      const id = card && card.dataset.product;
      const match = value === 'all' || FAMILY_BY_PRODUCT[id] === value;
      const wasHidden = cell.hidden;

      cell.hidden = !match;
      cell.classList.remove('is-filtered-in');

      if (!match) continue;
      shown += 1;
      // Una tarjeta que vuelve nunca debe quedarse en el estado inicial de .reveal.
      cell.classList.add('is-in');
      if (animate && wasHidden && !reduced()) {
        void cell.offsetWidth;
        cell.classList.add('is-filtered-in');
      }
    }

    for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.filter === value));
    setCount(shown);
    return shown;
  };

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      if (chip.dataset.filter === active) return;
      apply(chip.dataset.filter);
    });
  }

  /* ------------------------------------------------- salto al configurador */
  const navHeight = () => {
    const bar = document.querySelector('#top-nav .nav__bar');
    return bar ? Math.round(bar.getBoundingClientRect().height) : 0;
  };

  const cardOf = (productId) => root.querySelector(`[data-product-card][data-product="${productId}"]`);

  const configure = (productId, card = cardOf(productId)) => {
    if (!PRODUCTS.some((p) => p.id === productId)) return;

    const target = document.getElementById('configurador');

    // El configurador escucha esto, cambia de modelo y ya emite él su kg:model.
    const select = () => document.dispatchEvent(
      new CustomEvent('kg:configure', { detail: { productId }, bubbles: true }),
    );

    const land = (behavior) => {
      if (!target) return;
      const gap = navHeight() + 8;
      const shot = target.querySelector('[data-morph="shot"]');
      let top = target.getBoundingClientRect().top + window.scrollY - gap;
      // La foto de la ficha es el final del viaje: tiene que verse al llegar.
      // Donde el bloque empieza por el selector de modelo (móvil) esa foto cae
      // bajo el pliegue, así que allí se aterriza sobre ella; el modelo ya
      // viene elegido del catálogo y el selector queda justo encima.
      if (shot) {
        const box = shot.getBoundingClientRect();
        const y = box.top + window.scrollY - top;
        if (Math.min(window.innerHeight, y + box.height) - y < box.height / 3) {
          top = box.top + window.scrollY - gap;
        }
      }
      window.scrollTo({ top: Math.max(top, 0), behavior });
      // El teclado también tiene que aterrizar ahí, pero sin robarle el scroll suave.
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    };

    // Con View Transitions la tarjeta no lleva a la ficha: se convierte en ella,
    // y el salto de scroll ocurre dentro de la animación en vez de antes.
    if (target && canMorph(card)) {
      morphToDetail({ card, detail: target, select, land: () => land('auto') });
      return;
    }

    select();
    land(reduced() ? 'auto' : 'smooth');
  };

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-configure]');
    if (!btn || !root.contains(btn)) return;
    e.preventDefault();
    configure(btn.dataset.product, btn.closest('[data-product-card]'));
  });

  /* Las seis fotos son `loading="lazy"` y se quedan así: el navegador las pide
     cuando la rejilla se acerca a la pantalla, sin competir con el LCP del hero. */

  setCount(total);

  window.KG = window.KG || {};
  window.KG.catalog = { filter: apply, configure, family: (id) => FAMILY_BY_PRODUCT[id], active: () => active };
}
