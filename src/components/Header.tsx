import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { MODELS } from '@/data/models';
import { useAtTop } from '@/hooks/useScrollDirection';
import './Header.css';

/* ── Header theme ────────────────────────────────────────────────────────────
 *
 * A page asks for the transparent header by putting `data-header="transparent"`
 * on its root element. The header stays transparent for as long as that page's
 * first section still passes behind the header band, then crossfades to solid.
 *
 * Optional attributes on that same element:
 *   data-header-tone="light" | "dark"   tone of the *links* while transparent.
 *                                       "light" = white links over dark imagery.
 *                                       Defaults to "dark". Safe to change at
 *                                       runtime — it is observed.
 *   data-header-sentinel                put this on the element whose bottom
 *                                       edge ends the transparent phase. Without
 *                                       it the first child section is used.
 * ---------------------------------------------------------------------------*/

export type HeaderTheme = 'transparent' | 'solid';
export type HeaderTone = 'light' | 'dark';

export interface HeaderThemeState {
  theme: HeaderTheme;
  tone: HeaderTone;
}

const SOLID: HeaderThemeState = { theme: 'solid', tone: 'dark' };
const SOURCE_SELECTOR = '[data-header="transparent"]';
const SENTINEL_SELECTOR = '[data-header-sentinel]';

let snapshot: HeaderThemeState = SOLID;
const listeners = new Set<() => void>();

let source: HTMLElement | null = null;
let sentinel: Element | null = null;
let observer: IntersectionObserver | null = null;
let mutations: MutationObserver | null = null;
let frame = 0;
let cachedHeaderHeight = 0;

function headerHeight(): number {
  if (cachedHeaderHeight > 0) return cachedHeaderHeight;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
  const parsed = Number.parseFloat(raw);
  cachedHeaderHeight = Number.isFinite(parsed) && parsed > 0 ? parsed : 56;
  return cachedHeaderHeight;
}

function emit(next: HeaderThemeState) {
  if (next.theme === snapshot.theme && next.tone === snapshot.tone) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function toneOf(el: HTMLElement | null): HeaderTone {
  return el?.getAttribute('data-header-tone') === 'light' ? 'light' : 'dark';
}

/** The element whose exit from the header band flips the theme to solid. */
function sentinelFor(el: HTMLElement): Element {
  const explicit = el.matches(SENTINEL_SELECTOR) ? el : el.querySelector(SENTINEL_SELECTOR);
  if (explicit) return explicit;
  const first = el.firstElementChild;
  if (first && el.getBoundingClientRect().height > window.innerHeight * 1.6) return first;
  return el;
}

/** Synchronous equivalent of the IntersectionObserver test, so the first paint is correct. */
function coversHeaderBand(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  const viewportH = window.innerHeight || document.documentElement.clientHeight;
  const viewportW = window.innerWidth || document.documentElement.clientWidth;
  return rect.bottom > headerHeight() && rect.top < viewportH && rect.left < viewportW && rect.right > 0;
}

function detach() {
  observer?.disconnect();
  observer = null;
  sentinel = null;
  source = null;
}

function scan() {
  frame = 0;
  const next = document.querySelector<HTMLElement>(SOURCE_SELECTOR);

  if (next !== source || (sentinel !== null && !sentinel.isConnected)) {
    detach();
    source = next;
    if (source) {
      sentinel = sentinelFor(source);
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          emit({ theme: entry.isIntersecting ? 'transparent' : 'solid', tone: toneOf(source) });
        },
        { rootMargin: `-${headerHeight()}px 0px 0px 0px`, threshold: 0 },
      );
      observer.observe(sentinel);
    }
  }

  if (source && sentinel) {
    emit({ theme: coversHeaderBand(sentinel) ? 'transparent' : 'solid', tone: toneOf(source) });
  } else {
    emit(SOLID);
  }
}

function schedule() {
  if (frame === 0) frame = window.requestAnimationFrame(scan);
}

function start() {
  cachedHeaderHeight = 0;
  mutations = new MutationObserver(schedule);
  mutations.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-header', 'data-header-tone', 'data-header-sentinel'],
  });
  document.addEventListener('scroll', schedule, { passive: true, capture: true });
  window.addEventListener('resize', onResize, { passive: true });
  scan();
}

function stop() {
  mutations?.disconnect();
  mutations = null;
  document.removeEventListener('scroll', schedule, true);
  window.removeEventListener('resize', onResize);
  if (frame !== 0) window.cancelAnimationFrame(frame);
  frame = 0;
  detach();
  snapshot = SOLID;
}

function onResize() {
  cachedHeaderHeight = 0;
  schedule();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/**
 * Current header theme. Safe to call from any component — it needs no provider
 * and every caller shares one set of observers.
 */
export function useHeaderTheme(): HeaderThemeState {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SOLID,
  );
}

/* ── Navigation data ────────────────────────────────────────────────────────*/

interface NavItem {
  label: string;
  to: string;
}

const MODEL_LINKS: NavItem[] = MODELS.map((model) => ({ label: model.name, to: `/design/${model.id}` }));
const INVENTORY_LINK: NavItem = { label: 'Inventory', to: '/inventory' };
const CENTRE_LINKS: NavItem[] = [...MODEL_LINKS, INVENTORY_LINK];

const DRAWER_GROUPS: { id: string; label: string; links: NavItem[] }[] = [
  { id: 'vehicles', label: 'Vehicles', links: MODEL_LINKS },
  { id: 'shop', label: 'Shop', links: [INVENTORY_LINK] },
  { id: 'account', label: 'Account', links: [{ label: 'Your order', to: '/checkout' }] },
];

const FOCUSABLE =
  'a[href], button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

/* ── Header ─────────────────────────────────────────────────────────────────*/

export default function Header(): ReactElement {
  const { theme, tone } = useHeaderTheme();
  const atTop = useAtTop();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const openedFrom = useRef<'menu' | 'account'>('menu');
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const drawerId = useId();

  const openDrawer = (from: 'menu' | 'account') => (event: MouseEvent<HTMLButtonElement>) => {
    openedFrom.current = from;
    trigger.current = event.currentTarget;
    setOpen(true);
  };

  const close = useCallback(() => setOpen(false), []);

  /* Close on navigation. */
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  /* Focus management, focus trap and Esc. */
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const initial =
      openedFrom.current === 'account'
        ? panel.querySelector<HTMLElement>('[data-drawer-group="account"] a')
        : null;
    (initial ?? closeRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const returnTo = trigger.current;
      if (returnTo && returnTo.isConnected) returnTo.focus();
    };
  }, [open, close]);

  /* Body scroll lock, with scrollbar-width compensation so nothing shifts. */
  useEffect(() => {
    if (!open) return;
    const { body, documentElement: root } = document;
    const gap = window.innerWidth - root.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;

    body.style.overflow = 'hidden';
    if (gap > 0) {
      body.style.paddingRight = `${gap}px`;
      root.style.setProperty('--vm-scroll-gap', `${gap}px`);
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      root.style.removeProperty('--vm-scroll-gap');
    };
  }, [open]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'vm-nav__link is-active' : 'vm-nav__link';

  const drawer = (
    <div
      className="vm-drawer"
      id={drawerId}
      data-open={open ? 'true' : 'false'}
      inert={!open}
    >
      <div className="vm-drawer__scrim" aria-hidden="true" onClick={close} />
      <div className="vm-drawer__panel" role="dialog" aria-modal="true" aria-label="Site menu" ref={panelRef}>
        <div className="vm-drawer__head">
          <span className="vm-drawer__wordmark">VELA</span>
          <button type="button" className="vm-drawer__close" onClick={close} aria-label="Close menu" ref={closeRef}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          </button>
        </div>

        <nav className="vm-drawer__nav">
          {DRAWER_GROUPS.map((group) => (
            <section className="vm-drawer__group" key={group.id} data-drawer-group={group.id}>
              <h2 className="vm-drawer__groupLabel">{group.label}</h2>
              <ul className="vm-drawer__list">
                {group.links.map((link) => (
                  <li key={link.to + link.label}>
                    <NavLink
                      to={link.to}
                      className={({ isActive }) => (isActive ? 'vm-drawer__link is-active' : 'vm-drawer__link')}
                      onClick={close}
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </div>
  );

  return (
    <>
      <header
        className={`vm-header vm-header--${theme} vm-header--tone-${theme === 'transparent' ? tone : 'dark'}`}
        data-scrolled={atTop ? 'false' : 'true'}
      >
        <div className="vm-header__inner">
          <Link to="/" className="vm-header__wordmark" aria-label="Vela Motors — home">
            VELA
          </Link>

          <nav className="vm-header__centre" aria-label="Vehicles">
            <ul className="vm-nav">
              {CENTRE_LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink to={link.to} className={linkClass}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="vm-header__end" aria-label="Shop and account">
            <ul className="vm-nav">
              <li className="vm-header__shop">
                <Link to="/inventory" className="vm-nav__link">
                  Shop
                </Link>
              </li>
              <li className="vm-header__account">
                <button
                  type="button"
                  className="vm-nav__link"
                  onClick={openDrawer('account')}
                  aria-expanded={open}
                  aria-controls={drawerId}
                >
                  Account
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="vm-nav__link"
                  data-testid="menu-toggle"
                  onClick={openDrawer('menu')}
                  aria-expanded={open}
                  aria-controls={drawerId}
                >
                  Menu
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {createPortal(drawer, document.body)}
    </>
  );
}
