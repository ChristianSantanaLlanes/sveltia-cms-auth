import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
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
 * way a launch photograph would be specced, and books its own lens: the angle,
 * and which way down the page the nose points. What it does *not* book is the
 * framing — size and placement belong to the stage, which is the same stage in
 * all four chapters (see "One stage, four cars" below). So no two consecutive
 * sections put the same silhouette in the same pixels, and none of them moves
 * the camera. Falls back to the model's stock combination if the catalogue moves.
 */
interface HeroLook {
  paint: string;
  wheel: string;
  /** Lens: the three-quarter hero angle, or the flat profile. */
  view: CarView;
  /** Mirror the stage, so the nose points the other way down the page. */
  flip?: boolean;
}

type CarView = NonNullable<CarRenderProps['view']>;

const HERO_LOOK: Record<ModelId, HeroLook> = {
  /* 0 — white room, three-quarter, nose left: the establishing shot. */
  'vela-3': { paint: 'deep-blue', wheel: 'arachnid-20', view: 'front-3q' },
  /* 1 — black box: the camera walks around to the other flank. */
  'vela-y': { paint: 'stellar-white', wheel: 'turbine-20', view: 'front-3q', flip: true },
  /* 2 — graphite room, flat profile: the long low sedan, side on. */
  'vela-s': { paint: 'obsidian', wheel: 'sport-19', view: 'side' },
  /* 3 — charcoal room, back to the three-quarter. */
  'vela-x': { paint: 'quartz-grey', wheel: 'arachnid-22', view: 'front-3q' },
};

/* ── One stage, four cars ───────────────────────────────────────────────────
 *
 * A wheel notch has to change the chapter without moving the studio. That is
 * only true if the *painted* car — not the box it is drawn in — is the thing
 * held constant: CarRender fits each silhouette into its own 1200 × 420 frame,
 * and how much of that frame the paint actually covers depends on the body and
 * the lens (a flat profile paints far wider than a three-quarter, an SUV far
 * taller). Left alone, that hands every section a differently sized car.
 *
 * So the painted box is measured once per section, straight off the render,
 * and the car is scaled and placed from that measurement: one width, one
 * optical axis, one contact line, in all four rooms. Nothing is authored
 * per model — there is no per-chapter scale or offset left to drift.
 * -------------------------------------------------------------------------*/

/** CarRender's own coordinate system. `.vm-hero__plate` is exactly this box. */
const VIEW_W = 1200;
const VIEW_H = 420;
/** Painted car width as a fraction of the plate — ~60% of a 1440px section. */
const CAR_WIDTH = 0.727;
/** Where the tyres touch down, as a fraction of the plate height. */
const HORIZON = 0.9;

/** The camera move that puts this car on the shared stage. */
interface Fit {
  /** Scale applied to the render, so the paint lands at one fixed width. */
  scale: number;
  /** Offsets, as fractions of the plate, applied before that scale. */
  x: number;
  y: number;
}

/**
 * Measure the painted car inside a rendered section and derive its fit.
 *
 * `#…-car` is the render's body group — every panel, glass and tyre, and none
 * of the floor reflection or contact shadow, which have to travel with it
 * rather than define it.
 */
function measureFit(plate: HTMLElement | null): Fit | null {
  const car = plate?.querySelector<SVGGraphicsElement>('svg.car-render [id$="-car"]');
  if (!car || typeof car.getBBox !== 'function') return null;

  let box: DOMRect;
  try {
    box = car.getBBox();
  } catch {
    return null;
  }
  if (!(box.width > 0) || !(box.height > 0)) return null;

  const scale = (CAR_WIDTH * VIEW_W) / box.width;
  return {
    scale,
    x: (VIEW_W / 2 - scale * (box.x + box.width / 2)) / VIEW_W,
    y: (HORIZON * VIEW_H - scale * (box.y + box.height)) / VIEW_H,
  };
}

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

  const plateRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const [entered, setEntered] = useState(false);
  /* The first section is active before the observer has run, so its chevron is
     painted on the very first frame rather than fading in a beat late. */
  const [active, setActive] = useState(isFirst);

  const tone: 'light' | 'dark' = index % 2 === 0 ? 'light' : 'dark';
  const { paint, wheel, look } = useMemo(() => castLook(model), [model]);

  /* The stage, handed to CSS. Only the mirror is a property of the chapter;
     the horizon is a property of the page, and the fit is measured. */
  const stage = {
    '--vm-car-flip': look.flip ? -1 : 1,
    '--vm-horizon': `${HORIZON * 100}%`,
    ...(fit
      ? {
          '--vm-fit-scale': fit.scale,
          '--vm-fit-x': fit.x,
          '--vm-fit-y': fit.y,
        }
      : null),
  } as CSSProperties;
  const next = MODELS[index + 1];

  /* Measured before the browser paints, so the car is never seen at the size
     the render happened to give it. It is a ratio of the plate, not a pixel
     count, so it survives every resize without being taken again. */
  useLayoutEffect(() => {
    setFit(measureFit(plateRef.current));
  }, [model.id, look.view, wheel.id]);

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
        <div className="vm-hero__plate" ref={plateRef}>
          <div className="vm-hero__floor" aria-hidden="true" />
          <div className="vm-hero__pool" aria-hidden="true" />
          {/* The lens carries the entrance; the render inside it carries the
              fit, so the settle can never disturb where the car is parked. */}
          <div className="vm-hero__lens vm-hero__reveal">
            <CarRender
              body={model.body}
              paint={paint}
              wheel={wheel}
              view={look.view}
              className="vm-hero__car"
              label={`${model.name} in ${paint.name} on ${wheel.name}, ${
                look.view === 'side' ? 'side profile' : 'front three-quarter view'
              }`}
            />
          </div>
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
          {/* One CTA pair, one language, every chapter: a solid pill whose fill is
              the inverse of the room, and an outlined partner at the room's own
              text colour. Only the two tone variables underneath them change —
              never which of the two looks like the thing you click. */}
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
              variant="secondary"
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
