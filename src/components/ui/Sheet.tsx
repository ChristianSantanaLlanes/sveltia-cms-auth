import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery, usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import './Sheet.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: 'bottom' | 'right';
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Distance in px a bottom sheet must be dragged down before it dismisses. */
const DISMISS_THRESHOLD = 88;
const EXIT_MS = 240;

export function Sheet({ open, onClose, title, children, side }: SheetProps): ReactElement | null {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const reduced = usePrefersReducedMotion();
  // Below 768px it is always a bottom sheet; above, `side` picks the presentation.
  const placement: 'bottom' | 'right' = isDesktop ? side ?? 'right' : 'bottom';

  const [rendered, setRendered] = useState(open);
  const [entered, setEntered] = useState(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const dragStartRef = useRef(0);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setDrag(0);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const timer = window.setTimeout(() => setRendered(false), reduced ? 0 : EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, reduced]);

  useLockBodyScroll(rendered);

  // Move focus into the dialog on open, hand it back to the opener on close.
  useEffect(() => {
    if (!rendered) return;
    restoreFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    const raf = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      cancelAnimationFrame(raf);
      const target = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (target && document.contains(target)) target.focus();
    };
  }, [rendered]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (placement !== 'bottom') return;
    dragStartRef.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDrag(Math.max(0, event.clientY - dragStartRef.current));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const travelled = drag;
    setDrag(0);
    if (travelled > DISMISS_THRESHOLD) onClose();
  };

  if (!rendered) return null;

  const state = entered && open ? 'open' : 'closed';
  const labelId = title ? 'sheet-title' : undefined;

  return createPortal(
    <div className={`sheet sheet--${placement}`} data-state={state} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="sheet__scrim"
        data-state={state}
        aria-label="Close panel"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`sheet__panel${dragging ? ' is-dragging' : ''}`}
        data-state={state}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-label={title ? undefined : 'Panel'}
        tabIndex={-1}
      >
        {placement === 'bottom' ? (
          <div
            className="sheet__grabber"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span className="sheet__grabber-bar" />
          </div>
        ) : null}

        <div className="sheet__head">
          {title ? (
            <h2 className="sheet__title" id={labelId}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
              <path
                d="M2.5 2.5 13.5 13.5M13.5 2.5 2.5 13.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export default Sheet;
