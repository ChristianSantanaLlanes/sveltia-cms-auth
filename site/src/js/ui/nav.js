/** Pieza: nav. Barra global pegajosa, contador de carrito, barra de producto, buscador y menú. */
import { subscribe, totals } from '../store.js';
import { PRODUCTS, formatPrice, productById } from '../catalog.js';

const DESKTOP = '(min-width: 900px)';
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function initNav() {
  const root = document.querySelector('[data-nav]');
  if (!root) return;

  const bar = root.querySelector('.nav__bar');
  const toggle = root.querySelector('[data-nav-toggle]');
  const searchBtn = root.querySelector('[data-nav-search]');
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
      const shown = units > 99 ? '99' : String(units);
      badge.textContent = shown;
      badge.classList.toggle('is-empty', units === 0);
      badge.classList.toggle('is-wide', shown.length > 1);
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

  /* ------------------------------------------------- navegación común */
  const goTo = (href, productId) => {
    if (productId) document.dispatchEvent(new CustomEvent('kg:configure', { detail: { productId }, bubbles: true }));
    const target = href && document.querySelector(href);
    if (!target) return;
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  };

  /* ------------------------------------------------- menú y buscador */
  const findForm = root.querySelector('[data-nav-find]');
  const findInput = root.querySelector('[data-nav-find-input]');
  const findList = root.querySelector('[data-nav-find-list]');
  const findStatus = root.querySelector('[data-nav-find-status]');
  const menuList = root.querySelector('[data-nav-menu-list]');

  const index = [
    ...menuLinks
      .filter((a) => a.closest('[data-nav-menu-list]'))
      .map((a) => ({
        label: a.querySelector('span') ? a.querySelector('span').textContent : a.textContent.trim(),
        meta: a.querySelector('i') ? a.querySelector('i').textContent : '',
        href: a.getAttribute('href'),
        terms: '',
      })),
    ...PRODUCTS.map((p) => ({
      label: p.name,
      meta: formatPrice(p.base),
      href: '#configurador',
      productId: p.id,
      terms: [p.kanji, p.steel, p.hamon, p.tagline].filter(Boolean).join(' '),
    })),
  ].map((e) => ({ ...e, hay: fold(`${e.label} ${e.meta} ${e.terms}`) }));

  let results = [];

  const renderFind = (query) => {
    if (!findList || !menuList) return;
    const q = fold(query.trim());
    if (!q) {
      results = [];
      findList.hidden = true;
      findList.textContent = '';
      menuList.hidden = false;
      if (findStatus) findStatus.textContent = '';
      return;
    }
    results = index.filter((e) => e.hay.includes(q)).slice(0, 8);
    menuList.hidden = true;
    findList.hidden = false;
    findList.textContent = '';

    if (!results.length) {
      const li = document.createElement('li');
      li.className = 'nav__find-none';
      li.textContent = `Sin resultados para «${query.trim()}».`;
      findList.append(li);
    } else {
      for (const item of results) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = item.href;
        const name = document.createElement('span');
        name.textContent = item.label;
        const meta = document.createElement('i');
        meta.setAttribute('aria-hidden', 'true');
        meta.textContent = item.meta;
        a.append(name, meta);
        a.addEventListener('click', (e) => {
          e.preventDefault();
          closeMenu(false);
          goTo(item.href, item.productId);
        });
        li.append(a);
        findList.append(li);
      }
    }

    if (findStatus) {
      findStatus.textContent = results.length
        ? `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'} para ${query.trim()}`
        : `Sin resultados para ${query.trim()}`;
    }
  };

  const resetFind = () => {
    if (findInput) findInput.value = '';
    renderFind('');
  };

  if (findInput) findInput.addEventListener('input', () => renderFind(findInput.value));

  if (findForm) {
    findForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const first = results[0];
      if (!first) return;
      closeMenu(false);
      goTo(first.href, first.productId);
    });
  }

  let open = false;
  let lastFocus = null;
  let lockedY = 0;

  const setExpanded = (value) => {
    for (const btn of [toggle, searchBtn]) if (btn) btn.setAttribute('aria-expanded', String(value));
    if (toggle) toggle.setAttribute('aria-label', value ? 'Cerrar el menú' : 'Abrir el menú');
  };

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
    return [toggle, searchBtn, cartBtn, ...inMenu].filter((el) => el && el.offsetParent !== null);
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

  function openMenu(mode) {
    if (!menu) return;
    if (!open) {
      open = true;
      lastFocus = document.activeElement;
      root.classList.add('is-open');
      setExpanded(true);
      lockScroll();
      document.addEventListener('keydown', onKeydown);
    }
    const first = mode === 'search' && findInput ? findInput : menu.querySelector(FOCUSABLE);
    if (first) requestAnimationFrame(() => first.focus());
  }

  function closeMenu(restore = true) {
    if (!open) return;
    open = false;
    root.classList.remove('is-open');
    setExpanded(false);
    document.removeEventListener('keydown', onKeydown);
    unlockScroll();
    resetFind();
    if (restore && lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  if (toggle && menu) {
    toggle.addEventListener('click', () => (open ? closeMenu() : openMenu()));
  }

  if (searchBtn && menu) {
    searchBtn.addEventListener('click', () => {
      if (open && document.activeElement === findInput) closeMenu();
      else openMenu('search');
    });
  }

  if (menu) {
    for (const link of menuLinks) {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!document.querySelector(href)) { closeMenu(false); return; }
        e.preventDefault();
        closeMenu(false);
        goTo(href);
      });
    }

    const onBreakpoint = () => { if (open) closeMenu(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onBreakpoint);
    else desktop.addListener(onBreakpoint);
  }

  if (cartBtn) cartBtn.addEventListener('click', () => closeMenu(false));

  window.KG = window.KG || {};
  window.KG.nav = { openMenu, closeMenu, showModel, isOpen: () => open };
}
