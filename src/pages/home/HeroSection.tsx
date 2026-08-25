import { useCallback, useEffect, useId, useRef, useState, type ReactElement } from 'react';
import CarRender from '@/components/car/CarRender';
import Button from '@/components/ui/Button';
import { MODELS } from '@/data/models';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { money } from '@/lib/format';
import type { CarModel } from '@/types';
import './HeroSection.css';

export interface HeroSectionProps {
  model: CarModel;
  index: number;
  isFirst: boolean;
}

/* How much of the section has to be on screen before it counts as "entered"
   (its content reveals, once) and, higher up, as "active" (it owns the
   viewport, so the first section still shows its chevron). */
const ENTER_RATIO = 0.35;
const ACTIVE_RATIO = 0.55;

/**
 * One full-viewport marketing section: headline, the vehicle, the CTA block.
 * Backdrops alternate light/dark so no two consecutive sections read the same;
 * `data-tone` drives both the studio gradient and the on-dark type/button flip.
 */
export default function HeroSection({ model, index, isFirst }: HeroSectionProps): ReactElement {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const titleId = useId();

  const [entered, setEntered] = useState(false);
  /* The first section is active before the observer has run, so its chevron is
     painted on the very first frame rather than fading in a beat late. */
  const [active, setActive] = useState(isFirst);

  const tone: 'light' | 'dark' = index % 2 === 0 ? 'light' : 'dark';
  const paint = model.paints[0];
  const wheel = model.wheels[0];
  const next = MODELS[index + 1];

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        /* Entrance runs once and never reverses — scrolling back up must not
           replay it. */
        if (entry.intersectionRatio >= ENTER_RATIO) setEntered(true);
        setActive(entry.intersectionRatio >= ACTIVE_RATIO);
      },
      { threshold: [0, ENTER_RATIO, ACTIVE_RATIO, 0.9] },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToNext = useCallback(() => {
    const sibling = sectionRef.current?.nextElementSibling;
    if (!(sibling instanceof HTMLElement)) return;
    sibling.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [reducedMotion]);

  const showChevron = isFirst && next !== undefined;

  return (
    <section
      ref={sectionRef}
      className="vm-hero"
      data-hero-index={index}
      data-tone={tone}
      data-entered={entered ? 'true' : 'false'}
      data-chevron={showChevron ? 'true' : undefined}
      aria-labelledby={titleId}
    >
      <div className="vm-hero__head vm-hero__reveal">
        <h2 className="vm-hero__title" id={titleId}>
          {model.name}
        </h2>
        <p className="vm-hero__sub">{model.heroSub}</p>
      </div>

      <div className="vm-hero__stage vm-hero__reveal">
        <CarRender
          body={model.body}
          paint={paint}
          wheel={wheel}
          view="front-3q"
          className="vm-hero__car"
          label={`${model.name} in ${paint.name} with ${wheel.name}`}
        />
      </div>

      <div className="vm-hero__foot vm-hero__reveal">
        <ul className="vm-hero__specs">
          {model.highlights.slice(0, 4).map((highlight) => (
            <li className="vm-hero__spec" key={highlight.label}>
              <span className="vm-hero__specValue">
                {highlight.value}
                {highlight.unit ? <span className="vm-hero__specUnit">{highlight.unit}</span> : null}
              </span>
              <span className="vm-hero__specLabel">{highlight.label}</span>
            </li>
          ))}
        </ul>

        <div className="vm-hero__ctas">
          <Button
            to={`/design/${model.id}`}
            size="lg"
            variant={tone === 'dark' ? 'onImageLight' : 'onImageDark'}
            className="vm-hero__cta vm-hero__cta--primary"
            aria-label={`Order Now — ${model.name}`}
          >
            Order Now
          </Button>
          <Button
            to="/inventory"
            size="lg"
            variant={tone === 'dark' ? 'onImageDark' : 'onImageLight'}
            className="vm-hero__cta vm-hero__cta--secondary"
            aria-label={`Demo Drive — ${model.name}`}
          >
            Demo Drive
          </Button>
        </div>

        <p className="vm-hero__fine">
          {model.leadTime} · From {money(model.startingPrice)} before est. incentives
        </p>
      </div>

      {showChevron ? (
        <button
          type="button"
          className="vm-hero__chevron"
          data-visible={active ? 'true' : 'false'}
          tabIndex={active ? 0 : -1}
          aria-hidden={active ? undefined : true}
          onClick={scrollToNext}
        >
          <span className="sr-only">{`Scroll to ${next.name}`}</span>
          <svg
            className="vm-hero__chevronIcon"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9.5 12 15.5 18 9.5" />
          </svg>
        </button>
      ) : null}
    </section>
  );
}
