/** Pieza: nav. Barra global pegajosa, contador de carrito, barra de producto y menú móvil. */
import { subscribe, totals } from '../store.js';
import { PRODUCTS, formatPrice, productById } from '../catalog.js';

const DESKTOP = '(min-width: 900px)';
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function initNav() {
  const root = document.querySelector('[data-nav]');
  if (!root) return;

  const bar = root.querySelector('.nav__bar');
  const toggle = root.querySelector('[data-nav-toggle]');
  const menu = root.querySelector('[data-nav-menu]');
  const sub = root.querySelector('[data-nav-sub]');
  const subCta = sub && sub.querySelector('.nav__sub-cta');
  const cartBtn = root.querySelector('[data-cart-open]');
  const badge = root.querySelector('[data-cart-count]');
  const links = Array.from(root.querySelectorAll('[data-nav-link]'));
  const menuLinks = Array.from(root.querySelectorAll('[data-nav-menu-link]'));
  const desktop = window.matchMedia(DESKTOP);

  if (menu) menu.hidden = false;

  /* ---------------------------------------------------------------- scroll */
  let ticking = false;
  let scrolled = false;

  const readScroll = () => {
    ticking = false;
    const next = window.scrollY > 6;
    if (next === scrolled) return;
    scrolled = next;
    root.classList.toggle('is-scrolled', next);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(readScroll);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  readScroll();

  /* ------------------------------------------------- barra de producto */
  let pastHero = false;

  const setPastHero = (next) => {
    if (next === pastHero) return;
    pastHero = next;
    root.classList.toggle('is-past-hero', next);
    if (sub) sub.setAttribute('aria-hidden', next ? 'false' : 'true');
    if (subCta) {
      if (next) subCta.removeAttribute('tabindex');
      else subCta.setAttribute('tabindex', '-1');
    }
  };

  const hero = document.getElementById('hero');
  if (hero && 'IntersectionObserver' in window) {
    const navH = () => bar.getBoundingClientRect().height || 48;
    new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: `-${Math.round(navH())}px 0px 0px 0px`, threshold: 0 },
    ).observe(hero);
  } else {
    const fallback = () => setPastHero(window.scrollY > window.innerHeight * 0.72);
    window.addEventListener('scroll', fallback, { passive: true });
    fallback();
  }

  /* --------------------------------------------- modelo de la barra */
  const nameEl = root.querySelector('[data-nav-model-name]');
  const kanjiEl = root.querySelector('[data-nav-model-kanji]');
  const noteEl = root.querySelector('[data-nav-model-note]');
  const priceEl = root.querySelector('[data-nav-model-price]');

  const entryModel = PRODUCTS.reduce((a, b) => (b.base < a.base ? b : a), PRODUCTS[0]);

  const showModel = (product) => {
    if (!product || !nameEl) return;
    nameEl.textContent = product.name;
    if (kanjiEl) kanjiEl.textContent = product.kanji;
    if (noteEl) noteEl.textContent = `${product.steel} · ${product.lead}`;
    if (priceEl) priceEl.textContent = formatPrice(product.base);
  };

  showModel(entryModel);
  document.addEventListener('kg:model', (e) => showModel(productById(e.detail && e.detail.productId) || entryModel));

  /* ------------------------------------------------------ contador */
  let lastUnits = null;
  if (badge && cartBtn) {
    subscribe(() => {
      const { units } = totals();
      badge.textContent = String(units);
      badge.hidden = units === 0;
      cartBtn.setAttribute(
        'aria-label',
        units === 0 ? 'Abrir el carrito, vacío' : `Abrir el carrito, ${units} ${units === 1 ? 'artículo' : 'artículos'}`,
      );
      if (lastUnits !== null && units > lastUnits) {
        badge.classList.remove('is-bump');
        void badge.offsetWidth;
        badge.classList.add('is-bump');
      }
      lastUnits = units;
    });
  }

  /* --------------------------------------------------- scrollspy */
  const targets = links
    .map((a) => ({ link: a, el: document.querySelector(a.getAttribute('href')) }))
    .filter((t) => t.el);

  if (targets.length && 'IntersectionObserver' in window) {
    const visible = new Set();
    const paint = () => {
      let current = null;
      for (const t of targets) if (visible.has(t.el)) { current = t; break; }
      for (const t of targets) {
        if (t === current) t.link.setAttribute('aria-current', 'true');
        else t.link.removeAttribute('aria-current');
      }
    };
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      paint();
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    for (const t of targets) spy.observe(t.el);
  }

  /* ------------------------------------------------- menú móvil */
  let open = false;
  let lastFocus = null;
  let lockedY = 0;

  const lockScroll = () => {
    if (document.body.classList.contains('is-scroll-locked')) return;
    lockedY = window.scrollY;
    document.body.style.top = `-${lockedY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.classList.add('is-scroll-locked');
  };

  const unlockScroll = () => {
    if (!document.body.classList.contains('is-scroll-locked')) return;
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

  const trapList = () => {
    const inMenu = menu ? Array.from(menu.querySelectorAll(FOCUSABLE)) : [];
    return [toggle, cartBtn, ...inMenu].filter((el) => el && el.offsetParent !== null);
  };

  const onKeydown = (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key !== 'Tab') return;
    const items = trapList();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  function openMenu() {
    if (open || !menu) return;
    open = true;
    lastFocus = document.activeElement;
    root.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Cerrar el menú');
    lockScroll();
    document.addEventListener('keydown', onKeydown);
    const first = menu.querySelector(FOCUSABLE);
    if (first) requestAnimationFrame(() => first.focus());
  }

  function closeMenu(restore = true) {
    if (!open) return;
    open = false;
    root.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir el menú');
    document.removeEventListener('keydown', onKeydown);
    unlockScroll();
    if (restore && lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  if (toggle && menu) {
    toggle.addEventListener('click', () => (open ? closeMenu() : openMenu()));

    for (const link of menuLinks) {
      link.addEventListener('click', (e) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) { closeMenu(false); return; }
        e.preventDefault();
        closeMenu(false);
        requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
      });
    }

    const onBreakpoint = (e) => { if (e.matches) closeMenu(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onBreakpoint);
    else desktop.addListener(onBreakpoint);
  }

  if (cartBtn) cartBtn.addEventListener('click', () => closeMenu(false));

  window.KG = window.KG || {};
  window.KG.nav = { openMenu, closeMenu, showModel, isOpen: () => open };
}
