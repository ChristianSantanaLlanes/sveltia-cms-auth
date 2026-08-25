import { useEffect } from 'react';

interface SavedStyles {
  scrollY: number;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
  paddingRight: string;
}

/**
 * Reference counted so two overlapping overlays cannot clobber each other's
 * restore data — the page unlocks only when the last consumer releases it.
 */
let lockCount = 0;
let saved: SavedStyles | null = null;

function engage() {
  if (lockCount++ > 0) return;
  const body = document.body;
  const scrollY = window.scrollY;
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;

  saved = {
    scrollY,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight,
  };

  // `position: fixed` keeps iOS Safari from scrolling the page behind the overlay.
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
}

function release() {
  if (lockCount === 0) return;
  if (--lockCount > 0) return;
  const restore = saved;
  saved = null;
  if (!restore) return;

  const body = document.body;
  body.style.position = restore.position;
  body.style.top = restore.top;
  body.style.left = restore.left;
  body.style.right = restore.right;
  body.style.width = restore.width;
  body.style.overflow = restore.overflow;
  body.style.paddingRight = restore.paddingRight;

  window.scrollTo(0, restore.scrollY);
}

/** Freeze page scroll while `locked`, preserving scroll position and layout width. */
export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;
    engage();
    return release;
  }, [locked]);
}

export default useLockBodyScroll;
