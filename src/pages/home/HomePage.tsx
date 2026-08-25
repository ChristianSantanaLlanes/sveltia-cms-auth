import { useEffect, useRef, useState, type ReactElement } from 'react';
import { MODELS } from '@/data/models';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import HeroSection from './HeroSection';
import './HomePage.css';

/** Link tone the header should use while it floats over a given section tone. */
function headerToneFor(sectionTone: string | undefined): 'light' | 'dark' {
  return sectionTone === 'dark' ? 'light' : 'dark';
}

/* ── Discrete scrolling ──────────────────────────────────────────────────────
 *
 * CSS `scroll-snap-type: y mandatory` alone is not a section-at-a-time page: a
 * notch smaller than half a viewport snaps straight back where it came from, so
 * a normal mouse wheel or a light trackpad nudge reads as a frozen page. Wheel
 * and keys are therefore driven here — every gesture commits to exactly one
 * section — and CSS snap stays underneath as the safety net that catches touch
 * flings, scrollbar drags and resizes so nothing ever rests half-way.
 * ---------------------------------------------------------------------------*/

/** How long a programmatic move owns the scroller before a new gesture counts. */
const SETTLE_MS = 620;
/** Quiet gap that ends a gesture, so trackpad inertia never skips a section. */
const IDLE_MS = 110;
/** Sub-pixel wheel noise to ignore outright. */
const WHEEL_MIN = 4;
/** A sustained gesture past this much travel earns a second section. */
const SUSTAIN_FACTOR = 1.25;

/** Wheel deltas arrive in pixels, lines or pages depending on the device. */
function pixelDelta(event: WheelEvent): number {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

function isTypingTarget(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  return node.isContentEditable || /^(input|textarea|select)$/i.test(node.tagName);
}

/**
 * Home: one full-viewport section per model, snapped one notch at a time.
 *
 * The document is the scroll container — the footer lives outside this page in
 * RootLayout, so snapping is applied to the document root while the page is
 * mounted rather than to a nested scroller that would trap the footer below the
 * fold. A one-pixel snap target closes the list so the last notch of scroll
 * rests on the footer instead of springing back to the final section.
 */
export default function HomePage(): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  /* Section 0 is the light tone, so the header starts with dark links. */
  const [headerTone, setHeaderTone] = useState<'light' | 'dark'>('dark');
  const reducedMotion = usePrefersReducedMotion();

  /* Snap belongs to the document scroller, and only for as long as this page
     is on screen. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('vm-home-snapping');
    return () => root.classList.remove('vm-home-snapping');
  }, []);

  /* Which section owns the viewport right now. The header reads the tone off
     this element to flip its link colour over dark sections. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-hero-index]'));
    if (sections.length === 0) return;

    const ratios = new Map<HTMLElement, number>();
    for (const section of sections) ratios.set(section, 0);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target as HTMLElement, entry.intersectionRatio);
        }

        let winner = sections[0];
        let best = -1;
        for (const section of sections) {
          const ratio = ratios.get(section) ?? 0;
          if (ratio > best) {
            best = ratio;
            winner = section;
          }
        }

        setActiveIndex(Number(winner.dataset.heroIndex ?? 0));
        setHeaderTone(headerToneFor(winner.dataset.tone));
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  /* One notch = one section, for wheels and for keys. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return;

    let settleUntil = 0;
    let quietUntil = 0;
    let sustained = 0;
    let throwTimer = 0;

    /** Every place a scroll is allowed to come to rest, top to bottom. */
    const stops = (): number[] => {
      const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-hero-index]'));
      const y = window.scrollY;
      const list = sections.map((section) => Math.round(section.getBoundingClientRect().top + y));
      const max = Math.round(document.documentElement.scrollHeight - window.innerHeight);
      /* The tail below the last section — the notch that reveals the footer. */
      if (list.length > 0 && max - list[list.length - 1] > 8) list.push(max);
      return list;
    };

    /* Below the hero's own min-height a section is no longer a sensible unit of
       scroll, and CSS snap has stood down too — so must this. */
    const enabled = (): boolean =>
      window.matchMedia('(min-height: 641px)').matches && document.body.style.overflow !== 'hidden';

    /**
     * Travel `steps` stops in `direction`. One is the normal case; a single
     * wheel event carrying several viewports of delta is a deliberate throw and
     * is honoured as such, which is also how a page-key or a fling reads.
     */
    const move = (direction: 1 | -1, steps = 1): void => {
      const list = stops();
      if (list.length < 2) return;

      const y = window.scrollY;
      let index = 0;
      let closest = Number.POSITIVE_INFINITY;
      list.forEach((stop, i) => {
        const distance = Math.abs(stop - y);
        if (distance < closest) {
          closest = distance;
          index = i;
        }
      });
      /* Caught between stops: count from the one we are travelling away from. */
      if (direction > 0 && list[index] > y + 2) index -= 1;
      if (direction < 0 && list[index] < y - 2) index += 1;

      const next = Math.min(list.length - 1, Math.max(0, index + direction * steps));
      const target = list[next];

      settleUntil = performance.now() + SETTLE_MS * Math.min(steps, 3);
      sustained = 0;
      if (Math.abs(target - y) < 2) return;

      /* `scroll-snap-stop: always` would halt a multi-section move at the first
         section it passes; stand it down for the length of the throw. */
      const many = Math.abs(next - index) > 1 && !reducedMotion;
      if (many) {
        document.documentElement.classList.add('vm-home-throwing');
        window.clearTimeout(throwTimer);
        throwTimer = window.setTimeout(() => {
          document.documentElement.classList.remove('vm-home-throwing');
        }, SETTLE_MS * Math.min(steps, 3));
      }

      window.scrollTo({ top: target, behavior: reducedMotion ? 'auto' : 'smooth' });
    };

    const onWheel = (event: WheelEvent): void => {
      if (!enabled() || event.ctrlKey || event.defaultPrevented) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      /* Anything with its own scroller — the nav drawer — keeps its wheel. */
      if (event.target instanceof Element && event.target.closest('[aria-modal="true"]')) return;

      event.preventDefault();

      const delta = pixelDelta(event);
      if (Math.abs(delta) < WHEEL_MIN) return;

      const now = performance.now();
      if (now >= settleUntil && now >= quietUntil) {
        move(delta > 0 ? 1 : -1, Math.max(1, Math.round(Math.abs(delta) / window.innerHeight)));
        quietUntil = now + IDLE_MS;
        return;
      }

      /* The gesture is still running: hold the page until it lets go, unless it
         keeps pushing well past one section's worth of travel. */
      quietUntil = now + IDLE_MS;
      if (now < settleUntil) {
        sustained = 0;
        return;
      }
      sustained += Math.abs(delta);
      if (sustained >= window.innerHeight * SUSTAIN_FACTOR) move(delta > 0 ? 1 : -1);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (!enabled() || event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const list = stops();
      let handled = true;

      switch (event.key) {
        case 'ArrowDown':
        case 'PageDown':
          move(1);
          break;
        case 'ArrowUp':
        case 'PageUp':
          move(-1);
          break;
        case ' ':
          /* Space still activates whatever the user has focused. */
          if (event.target instanceof HTMLElement && event.target.closest('a, button, [role="button"]')) {
            return;
          }
          move(event.shiftKey ? -1 : 1);
          break;
        case 'Home':
          settleUntil = performance.now() + SETTLE_MS;
          window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
          break;
        case 'End':
          settleUntil = performance.now() + SETTLE_MS;
          window.scrollTo({ top: list[list.length - 1] ?? 0, behavior: reducedMotion ? 'auto' : 'smooth' });
          break;
        default:
          handled = false;
      }

      if (handled) event.preventDefault();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(throwTimer);
      document.documentElement.classList.remove('vm-home-throwing');
    };
  }, [reducedMotion]);

  return (
    <div
      className="vm-home"
      ref={rootRef}
      data-header="transparent"
      data-header-sentinel=""
      data-header-tone={headerTone}
      data-active-section={activeIndex}
    >
      <h1 className="sr-only">Vela Motors electric vehicles</h1>

      {MODELS.map((model, index) => (
        <HeroSection key={model.id} model={model} index={index} isFirst={index === 0} />
      ))}

      {/* Final snap target: without it a mandatory snap container refuses to
          rest anywhere past the last section, and the footer stays unreachable. */}
      <div className="vm-home__tail" aria-hidden="true" />
    </div>
  );
}
