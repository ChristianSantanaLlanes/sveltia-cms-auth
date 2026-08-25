import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import CarRender, { type CarRenderProps } from '@/components/car/CarRender';
import Button from '@/components/ui/Button';
import { MODELS } from '@/data/models';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { money } from '@/lib/format';
import type { CarModel, ModelId, PaintOption, WheelOption } from '@/types';
import type { CSSProperties } from 'react';
import './HeroSection.css';

export interface HeroSectionProps {
  model: CarModel;
  index: number;
  isFirst: boolean;
}

/* How much of the section has to be on screen before it counts as "entered"
   (its content reveals, once) and, higher up, as "active" (it owns the
   viewport, so the first section still shows its chevron). */
/* Low on purpose: a section has to be told to reveal near the *start* of the
   move that brings it in, so the entrance is finished — not mid-fade — by the
   time the scroll comes to rest on it. */
const ENTER_RATIO = 0.12;
const ACTIVE_RATIO = 0.55;
/* Backstop. The entrance belongs to the first frames of a visit; a section that
   has still not been reached by then has nothing to reveal *on arrival* and
   must simply be there, fully painted, whenever the reader gets to it. Without
   this, anything that renders the page without scrolling it — a print, a
   full-page capture, a headless reader — finds three empty rooms. */
const SETTLE_ALL_MS = 900;

/**
 * The hero car is cast, not defaulted — and so is the camera.
 *
 * Every section pairs a paint that reads against its own backdrop (dark bodies
 * on the light studio, light bodies on the dark one) with the halo wheel, the
 * way a launch photograph would be specced. It also books its own setup: the
 * lens angle, which way the car faces, how much of the frame it fills and where
 * it sits in it. No two consecutive chapters put the same silhouette in the same
 * pixels, which is the difference between four photographs and one template run
 * four times. Falls back to the model's stock combination if the catalogue moves.
 */
interface HeroLook {
  paint: string;
  wheel: string;
  /** Lens: the three-quarter hero angle, or the flat profile. */
  view: CarView;
  /** Mirror the stage, so the nose points the other way down the page. */
  flip?: boolean;
  /** Plate size as a multiple of the base frame width. */
  scale: number;
  /** Where the car sits in the frame, in px from the composed centre. */
  shift: number;
}

type CarView = NonNullable<CarRenderProps['view']>;

const HERO_LOOK: Record<ModelId, HeroLook> = {
  /* 0 — white room, three-quarter, nose left: the establishing shot. */
  'vela-3': { paint: 'deep-blue', wheel: 'arachnid-20', view: 'front-3q', scale: 1.02, shift: 0 },
  /* 1 — black box, the camera walks around to the other flank and steps back;
     the tallest body on the page sits lowest in the frame. */
  'vela-y': { paint: 'stellar-white', wheel: 'turbine-20', view: 'front-3q', flip: true, scale: 0.93, shift: 30 },
  /* 2 — graphite room, flat profile: the long low sedan filling the frame edge
     to edge, lifted so the roofline breathes under the headline. */
  'vela-s': { paint: 'obsidian', wheel: 'sport-19', view: 'side', scale: 1, shift: -14 },
  /* 3 — charcoal room, back to the three-quarter but closer and lower. */
  'vela-x': { paint: 'quartz-grey', wheel: 'arachnid-22', view: 'front-3q', scale: 1.05, shift: 18 },
};

/** Optical centre of the painted car inside its own viewBox, per lens. */
const VIEW_NUDGE: Record<CarView, number> = { 'front-3q': -2.7, side: -0.3 };

interface Cast {
  paint: PaintOption;
  wheel: WheelOption;
  look: HeroLook;
}

function castLook(model: CarModel): Cast {
  const look = HERO_LOOK[model.id] ?? HERO_LOOK['vela-3'];
  return {
    look,
    paint: model.paints.find((p) => p.id === look.paint) ?? model.paints[0],
    wheel: model.wheels.find((w) => w.id === look.wheel) ?? model.wheels[0],
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
  const { paint, wheel, look } = useMemo(() => castLook(model), [model]);

  /* The camera setup for this chapter, handed to CSS. The nudge that puts the
     painted car's optical centre under the centred headline is a property of
     the lens, and it changes sign when the stage is mirrored. */
  const stage = {
    '--vm-car-scale': look.scale,
    '--vm-car-shift': `${look.shift}px`,
    '--vm-car-flip': look.flip ? -1 : 1,
    '--vm-car-nudge': VIEW_NUDGE[look.view] * (look.flip ? -1 : 1),
  } as CSSProperties;
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
      { threshold: [0, ENTER_RATIO, 0.3, ACTIVE_RATIO, 0.9] },
    );

    observer.observe(el);
    const backstop = window.setTimeout(() => setEntered(true), SETTLE_ALL_MS);
    return () => {
      observer.disconnect();
      window.clearTimeout(backstop);
    };
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
      data-view={look.view}
      style={stage}
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
            view={look.view}
            className="vm-hero__car vm-hero__reveal"
            label={`${model.name} in ${paint.name} on ${wheel.name}, ${
              look.view === 'side' ? 'side profile' : 'front three-quarter view'
            }`}
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
