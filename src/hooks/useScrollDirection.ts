import { useSyncExternalStore } from 'react';

export type ScrollDirection = 'up' | 'down';

export interface ScrollState {
  /** Direction of the last movement large enough to count. Starts at `'up'`. */
  direction: ScrollDirection;
  /** Current document scroll offset in px. */
  y: number;
  /** True while the document is within `AT_TOP_OFFSET` px of the very top. */
  atTop: boolean;
}

/** Movement smaller than this is ignored, so the direction never flickers. */
const THRESHOLD = 6;
/** How far from the top still counts as "at top". */
const AT_TOP_OFFSET = 8;

const INITIAL: ScrollState = { direction: 'up', y: 0, atTop: true };

/* One rAF-throttled listener feeds every consumer, so a page can read the
   scroll position from several components without stacking up listeners. */
let snapshot: ScrollState = INITIAL;
const listeners = new Set<() => void>();
let anchorY = 0;
let frame = 0;

const readY = (): number =>
  window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

function measure() {
  frame = 0;
  const y = readY();
  const delta = y - anchorY;
  let direction = snapshot.direction;

  if (Math.abs(delta) >= THRESHOLD) {
    direction = delta > 0 ? 'down' : 'up';
    anchorY = y;
  }
  const atTop = y <= AT_TOP_OFFSET;
  if (atTop) direction = 'up';

  if (snapshot.y === y && snapshot.direction === direction && snapshot.atTop === atTop) return;
  snapshot = { direction, y, atTop };
  for (const listener of listeners) listener();
}

function schedule() {
  if (frame === 0) frame = window.requestAnimationFrame(measure);
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    anchorY = readY();
    /* Capture phase, so a scroll inside a nested container also triggers a
       re-measure. Only the document scroller is reported. */
    document.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule, { passive: true });
    measure();
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    document.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    if (frame !== 0) window.cancelAnimationFrame(frame);
    frame = 0;
  };
}

/**
 * Scroll position and direction of travel, measured once per animation frame.
 *
 * Note that `y` changes constantly while the page moves, so a component using
 * this re-renders throughout a scroll. When only the boundary matters, prefer
 * `useAtTop()`, which re-renders on the crossing alone.
 */
export function useScrollDirection(): ScrollState {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => INITIAL,
  );
}

/** True while the page is parked at the top. Re-renders only when that flips. */
export function useAtTop(offset: number = AT_TOP_OFFSET): boolean {
  return useSyncExternalStore(
    subscribe,
    () => snapshot.y <= offset,
    () => true,
  );
}

export default useScrollDirection;
