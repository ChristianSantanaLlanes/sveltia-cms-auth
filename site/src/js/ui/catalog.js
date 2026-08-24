/** Pieza: catalog. Filtro por trazo del temple y salto al configurador.
 *  Las seis tarjetas están escritas en el HTML: aquí no se pinta ninguna,
 *  solo se ocultan, se cuentan y se conectan con el configurador. */
import { PRODUCTS } from '../catalog.js';

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

  const configure = (productId) => {
    if (!PRODUCTS.some((p) => p.id === productId)) return;

    // El configurador escucha esto, cambia de modelo y ya emite él su kg:model.
    document.dispatchEvent(new CustomEvent('kg:configure', { detail: { productId }, bubbles: true }));

    const target = document.getElementById('configurador');
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - navHeight() - 8;
    window.scrollTo({ top: Math.max(top, 0), behavior: reduced() ? 'auto' : 'smooth' });

    // El teclado también tiene que aterrizar ahí, pero sin robarle el scroll suave.
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-configure]');
    if (!btn || !root.contains(btn)) return;
    e.preventDefault();
    configure(btn.dataset.product);
  });

  /* Las seis fotos son `loading="lazy"` y se quedan así: el navegador las pide
     cuando la rejilla se acerca a la pantalla, sin competir con el LCP del hero. */

  setCount(total);

  window.KG = window.KG || {};
  window.KG.catalog = { filter: apply, configure, family: (id) => FAMILY_BY_PRODUCT[id], active: () => active };
}
