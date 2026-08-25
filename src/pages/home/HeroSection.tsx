import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import CarRender from '@/components/car/CarRender';
import Button from '@/components/ui/Button';
import { MODELS } from '@/data/models';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { money } from '@/lib/format';
import type { CarModel, ModelId, PaintOption, WheelOption } from '@/types';
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
 * The hero car is cast, not defaulted. Every section pairs a paint that reads
 * against its own backdrop — dark bodies on the light studio, light bodies on
 * the dark one — with the halo wheel, the way a launch photograph would be
 * specced. Falls back to the model's stock combination if the catalogue moves.
 */
const HERO_LOOK: Record<ModelId, { paint: string; wheel: string }> = {
  'vela-3': { paint: 'deep-blue', wheel: 'arachnid-20' },
  'vela-y': { paint: 'stellar-white', wheel: 'turbine-20' },
  'vela-s': { paint: 'obsidian', wheel: 'sport-19' },
  'vela-x': { paint: 'quartz-grey', wheel: 'arachnid-22' },
};

function castLook(model: CarModel): { paint: PaintOption; wheel: WheelOption } {
  const look = HERO_LOOK[model.id];
  return {
    paint: model.paints.find((p) => p.id === look?.paint) ?? model.paints[0],
    wheel: model.wheels.find((w) => w.id === look?.wheel) ?? model.wheels[0],
  };
}

/**
 * One full-viewport marketing section: headline, the vehicle, the CTA block.
 *
 * The backdrop is a CSS cyc wall lit like a real studio: a key behind the car,
 * a strip light skimming the roofline, a floor plane that rises seamlessly out
 * of the wall at the exact y where the tyres touch down, a pool of bounced
 * light on it, and one vignette laid over all of it so the frame reads as a
 * single exposure rather than stacked gradients. Tones alternate light/dark
 * down the page; `data-tone` drives the whole palette.
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
  const { paint, wheel } = useMemo(() => castLook(model), [model]);
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
      <div className="vm-hero__backdrop" aria-hidden="true" />

      <div className="vm-hero__head vm-hero__reveal">
        <h2 className="vm-hero__title" id={titleId}>
          {model.heroHeadline || model.name}
        </h2>
        <p className="vm-hero__sub">{model.heroSub}</p>
      </div>

      <div className="vm-hero__stage">
        <div className="vm-hero__plate">
          <div className="vm-hero__floor" aria-hidden="true" />
          <div className="vm-hero__pool" aria-hidden="true" />
          <CarRender
            body={model.body}
            paint={paint}
            wheel={wheel}
            view="front-3q"
            className="vm-hero__car vm-hero__reveal"
            label={`${model.name} in ${paint.name} on ${wheel.name}`}
          />
        </div>
      </div>

      {/* One exposure falloff over wall, floor and the outer edges of the car,
          so the frame reads as a single photograph. */}
      <div className="vm-hero__vignette" aria-hidden="true" />

      <div className="vm-hero__foot">
        <ul className="vm-hero__specs vm-hero__reveal">
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

        <div className="vm-hero__actions vm-hero__reveal">
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
