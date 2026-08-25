import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { miles, money, num } from '@/lib/format';
import {
  CONDITION_OPTIONS,
  MODEL_OPTIONS,
  PAINT_OPTIONS,
  PRICE_BOUNDS,
  RANGE_BOUNDS,
  TRIM_OPTIONS,
  WHEEL_OPTIONS,
  facetCounts,
  type FacetOption,
  type InventoryFilters,
  type MultiKey,
  type SetFilter,
} from './useInventoryFilters';
import type { WheelOption } from '@/types';
import './FilterRail.css';

export interface FilterRailProps {
  filters: InventoryFilters;
  setFilter: SetFilter;
  toggleFilter: (key: MultiKey, id: string) => void;
  reset: () => void;
  activeCount: number;
}

const DESKTOP = '(min-width: 1024px)';

const isDesktopNow = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DESKTOP).matches
    : true;

type SectionId = 'model' | 'condition' | 'price' | 'range' | 'paint' | 'wheel' | 'trim';

function Chevron(): ReactElement {
  return (
    <svg className="rail__chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3.5 8.4 6.6 11.5 12.5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Section shell ──────────────────────────────────────────────────────────*/

interface SectionProps {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: (id: SectionId) => void;
  /** Number of active choices in this dimension; a bare dot when 0 but active. */
  badge?: number;
  dot?: boolean;
  panelId: string;
  children: ReactNode;
}

function Section({ id, title, open, onToggle, badge, dot, panelId, children }: SectionProps): ReactElement {
  const marked = (badge ?? 0) > 0 || dot;
  return (
    <section className="rail__section" data-open={open || undefined} data-marked={marked || undefined}>
      <h3 className="rail__heading">
        <button
          type="button"
          className="rail__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(id)}
        >
          <span className="rail__label">{title}</span>
          {badge ? (
            <span className="rail__badge">{badge}</span>
          ) : dot ? (
            <span className="rail__dot" aria-hidden="true" />
          ) : null}
          <Chevron />
        </button>
      </h3>
      <div className="rail__panel" id={panelId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

/* ── Checkbox rows ──────────────────────────────────────────────────────────*/

interface CheckRowProps {
  id: string;
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
  testId?: string;
}

function CheckRow({ id, label, count, checked, onChange, testId }: CheckRowProps): ReactElement {
  return (
    <label className="row" data-empty={!checked && count === 0 ? '' : undefined} data-id={id}>
      <input
        type="checkbox"
        className="row__input"
        checked={checked}
        onChange={onChange}
        data-testid={testId}
      />
      <span className="row__box" aria-hidden="true">
        <Check />
      </span>
      <span className="row__label">{label}</span>
      <span className="row__count">{num(count)}</span>
    </label>
  );
}

interface GroupProps {
  dimension: MultiKey;
  options: FacetOption[];
  filters: InventoryFilters;
  toggleFilter: (key: MultiKey, id: string) => void;
  testIdPrefix?: string;
}

/**
 * Every checkbox dimension renders through this one grid — a single column,
 * one label column and one count column — so Model, Trim and Condition stack
 * on one rhythm instead of competing for the rail's width.
 */
function CheckGroup({ dimension, options, filters, toggleFilter, testIdPrefix }: GroupProps): ReactElement {
  const counts = useMemo(() => facetCounts(filters, dimension), [filters, dimension]);
  const selected = filters[dimension] as string[];

  return (
    <div className="rail__rows">
      {options.map((option) => (
        <CheckRow
          key={option.id}
          id={option.id}
          label={option.label}
          count={counts[option.id] ?? 0}
          checked={selected.includes(option.id)}
          onChange={() => toggleFilter(dimension, option.id)}
          testId={testIdPrefix ? `${testIdPrefix}${option.id}` : undefined}
        />
      ))}
    </div>
  );
}

/* ── Live caption shared by both swatch grids ───────────────────────────────*/

interface CaptionProps {
  name: string | null;
  count: number | null;
  fallback: string;
  domain: string;
}

/**
 * The same two-part line every control in the rail reports itself with: what is
 * selected on the left at 14px/500, the domain it was drawn from on the right
 * at 12px muted.
 */
function SwatchCaption({ name, count, fallback, domain }: CaptionProps): ReactElement {
  return (
    <p className="swatches__caption" aria-hidden="true">
      <span className="swatches__name">{name ?? fallback}</span>
      <span className="swatches__stock">
        {name && count !== null ? `${num(count)} in stock` : domain}
      </span>
    </p>
  );
}

/** Tracks whichever option the pointer or focus ring is currently on. */
function useHint() {
  const [hint, setHint] = useState<string | null>(null);
  const handlers = useCallback(
    (id: string) => ({
      onPointerEnter: () => setHint(id),
      onPointerLeave: () => setHint((prev) => (prev === id ? null : prev)),
      onFocus: () => setHint(id),
      onBlur: () => setHint((prev) => (prev === id ? null : prev)),
    }),
    [],
  );
  return { hint, handlers };
}

/* ── Paint ──────────────────────────────────────────────────────────────────*/

/**
 * Relative luminance of a paint's base hex. Stellar White (#e8eaec) sits at
 * ~1.06:1 against the rail's white ground, so a chip that only carried the
 * 8%-ink hairline every other paint uses would read as an empty hole. Light
 * paints get a drawn ring instead; everything darker keeps the hairline.
 */
function isLightPaint(hex: string): boolean {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.78;
}

function PaintGrid({ filters, toggleFilter }: Pick<FilterRailProps, 'filters' | 'toggleFilter'>): ReactElement {
  const counts = useMemo(() => facetCounts(filters, 'paint'), [filters]);
  const { hint, handlers } = useHint();
  const selected = filters.paint;

  const focus = hint ?? (selected.length === 1 ? selected[0] : null);
  const paint = focus ? PAINT_OPTIONS.find((p) => p.id === focus) ?? null : null;
  const fallback = selected.length > 1 ? `${selected.length} paints selected` : 'Any paint';

  return (
    <div className="swatches">
      <div className="swatches__grid swatches__grid--paint">
        {PAINT_OPTIONS.map((option) => {
          const count = counts[option.id] ?? 0;
          const active = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className="swatch"
              data-testid={`paint-${option.id}`}
              data-empty={!active && count === 0 ? '' : undefined}
              aria-pressed={active}
              aria-label={`${option.name}, ${count} available`}
              style={
                {
                  '--swatch-base': option.hex,
                  '--swatch-ring': isLightPaint(option.hex) ? 'var(--text-tertiary)' : 'var(--ink-08)',
                } as CSSProperties
              }
              onClick={() => toggleFilter('paint', option.id)}
              {...handlers(option.id)}
            >
              <span className="swatch__disc" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <SwatchCaption
        name={paint?.name ?? null}
        count={paint ? counts[paint.id] ?? 0 : null}
        fallback={fallback}
        domain={`of ${PAINT_OPTIONS.length} finishes`}
      />
    </div>
  );
}

/* ── Wheels ─────────────────────────────────────────────────────────────────*/

/** Polar helper for the rim glyphs: 48×48 box, centre 24,24, 0° at twelve o'clock. */
function polar(r: number, deg: number): string {
  const a = ((deg - 90) * Math.PI) / 180;
  return `${(24 + r * Math.cos(a)).toFixed(2)} ${(24 + r * Math.sin(a)).toFixed(2)}`;
}

/**
 * The glyphs are drawn to scale: the tyre is a fixed 21r and the rim grows with
 * the wheel size, so an 18" aero and a 19" aero differ by their sidewall the way
 * the real wheels do — the row never shows the same picture twice.
 */
const rimRadius = (size: number) => 13.4 + (size - 18) * 0.95;

interface RimSpec {
  paths: string[];
  width: number;
  opacity: number;
  face?: boolean;
}

function rimSpec(style: WheelOption['style'], rim: number): RimSpec {
  const spread = (n: number, fn: (deg: number) => string) =>
    Array.from({ length: n }, (_, i) => fn((360 / n) * i));
  const hub = 5.4;
  const tip = rim - 1.2;

  switch (style) {
    case 'aero':
      return {
        face: true,
        width: 4.8,
        opacity: 0.34,
        paths: spread(5, (d) => `M${polar(hub + 1, d)} L${polar(tip - 0.6, d)}`),
      };
    case 'sport':
      return {
        width: 1.9,
        opacity: 0.5,
        paths: spread(5, (d) => `M${polar(hub, d - 7)} L${polar(tip, d - 7)} M${polar(hub, d + 7)} L${polar(tip, d + 7)}`),
      };
    case 'turbine':
      return {
        width: 2.3,
        opacity: 0.46,
        paths: spread(9, (d) => `M${polar(hub, d)} Q${polar((hub + tip) / 2, d + 10)} ${polar(tip, d + 20)}`),
      };
    case 'arachnid':
    default:
      return {
        width: 1.2,
        opacity: 0.58,
        paths: spread(10, (d) => `M${polar(hub - 0.4, d)} L${polar(tip, d + 5)}`),
      };
  }
}

function RimGlyph({ style, size }: { style: WheelOption['style']; size: number }): ReactElement {
  const rim = rimRadius(size);
  const spec = rimSpec(style, rim);
  return (
    <svg className="wheel__art" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r={21 - 1.7} fill="none" stroke="currentColor" strokeWidth="3.4" strokeOpacity="0.22" />
      {spec.face ? <circle cx="24" cy="24" r={rim} fill="currentColor" fillOpacity="0.08" /> : null}
      <circle cx="24" cy="24" r={rim} fill="none" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.36" />
      <g stroke="currentColor" strokeWidth={spec.width} strokeOpacity={spec.opacity} strokeLinecap="round" fill="none">
        {spec.paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle cx="24" cy="24" r="3" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}

function WheelGrid({ filters, toggleFilter }: Pick<FilterRailProps, 'filters' | 'toggleFilter'>): ReactElement {
  const counts = useMemo(() => facetCounts(filters, 'wheel'), [filters]);
  const { hint, handlers } = useHint();
  const selected = filters.wheel;

  const focus = hint ?? (selected.length === 1 ? selected[0] : null);
  const wheel = focus ? WHEEL_OPTIONS.find((w) => w.id === focus) ?? null : null;
  const fallback = selected.length > 1 ? `${selected.length} wheels selected` : 'Any wheel';

  return (
    <div className="swatches">
      <div className="swatches__grid swatches__grid--wheel">
        {WHEEL_OPTIONS.map((option) => {
          const count = counts[option.id] ?? 0;
          const active = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className="wheel"
              data-testid={`wheel-${option.id}`}
              data-empty={!active && count === 0 ? '' : undefined}
              aria-pressed={active}
              aria-label={`${option.name}, ${count} available`}
              onClick={() => toggleFilter('wheel', option.id)}
              {...handlers(option.id)}
            >
              <span className="wheel__plate" aria-hidden="true">
                <RimGlyph style={option.style} size={option.size} />
              </span>
              <span className="wheel__size">{option.size}&Prime;</span>
            </button>
          );
        })}
      </div>
      <SwatchCaption
        name={wheel?.name ?? null}
        count={wheel ? counts[wheel.id] ?? 0 : null}
        fallback={fallback}
        domain={`of ${WHEEL_OPTIONS.length} sets`}
      />
    </div>
  );
}

/* ── Sliders ────────────────────────────────────────────────────────────────*/

/**
 * Sliders paint from a local draft and only write the URL when the thumb is
 * released (with a trailing debounce as a safety net), so dragging stays at
 * 60fps and never floods the history stack.
 */
function useSliderDraft<T>(value: T, commit: (next: T) => void, delay = 320) {
  const [draft, setDraft] = useState<T>(value);
  const draftRef = useRef<T>(value);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (dirty.current) return;
    draftRef.current = value;
    setDraft(value);
  }, [value]);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    commit(draftRef.current);
  }, [commit]);

  const update = useCallback(
    (next: T) => {
      draftRef.current = next;
      dirty.current = true;
      setDraft(next);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (!dirty.current) return;
        dirty.current = false;
        commit(draftRef.current);
      }, delay);
    },
    [commit, delay],
  );

  return { draft, update, flush };
}

/** Events that mean "the shopper has finished moving this thumb". */
const releaseHandlers = (flush: () => void) => ({
  onPointerUp: flush,
  onPointerCancel: flush,
  onKeyUp: flush,
  onBlur: flush,
  onTouchEnd: flush,
});

interface PriceDraft {
  low: number;
  high: number;
}

function PriceSlider({ filters, setFilter }: Pick<FilterRailProps, 'filters' | 'setFilter'>): ReactElement {
  const { min, max, step } = PRICE_BOUNDS;
  const span = max - min;

  const value = useMemo<PriceDraft>(
    () => ({ low: filters.minPrice, high: filters.maxPrice }),
    [filters.minPrice, filters.maxPrice],
  );

  const commit = useCallback(
    (next: PriceDraft) => setFilter({ minPrice: next.low, maxPrice: next.high }),
    [setFilter],
  );

  const { draft, update, flush } = useSliderDraft(value, commit);
  const release = releaseHandlers(flush);

  const lowPct = ((draft.low - min) / span) * 100;
  const highPct = ((draft.high - min) / span) * 100;

  const atLow = draft.low === min;
  const atHigh = draft.high === max;
  /* Ink means "this much of the domain survived the filter". At rest nothing
     has been cut, so the track stays entirely in the remainder colour and the
     two handles read as the untouched ends of the scale — the ink band only
     exists once the shopper has actually narrowed something. */
  const cut = !atLow || !atHigh;
  const selection = atLow && atHigh
    ? 'Any price'
    : atLow
      ? `Under ${money(draft.high)}`
      : atHigh
        ? `${money(draft.low)} and up`
        : `${money(draft.low)} – ${money(draft.high)}`;

  return (
    <div className="slider">
      <div className="slider__control">
        <div className="slider__track" aria-hidden="true">
          {cut ? (
            <span className="slider__fill" style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }} />
          ) : null}
        </div>

        <input
          {...release}
          type="range"
          className="slider__input slider__input--low"
          min={min}
          max={max}
          step={step}
          value={draft.low}
          aria-label="Minimum price"
          aria-valuetext={money(draft.low)}
          style={{ zIndex: lowPct > 88 ? 4 : 3 }}
          onChange={(event) =>
            update({ ...draft, low: Math.min(Number(event.target.value), draft.high - step) })
          }
        />
        <input
          {...release}
          type="range"
          className="slider__input slider__input--high"
          min={min}
          max={max}
          step={step}
          value={draft.high}
          aria-label="Maximum price"
          aria-valuetext={draft.high === max ? `${money(max)} or more` : money(draft.high)}
          onChange={(event) =>
            update({ ...draft, high: Math.max(Number(event.target.value), draft.low + step) })
          }
        />
      </div>

      <p className="slider__caption" aria-hidden="true">
        <span className="slider__value">{selection}</span>
        <span className="slider__scale">
          of {money(min)}–{money(max)}
        </span>
      </p>
    </div>
  );
}

function RangeSlider({ filters, setFilter }: Pick<FilterRailProps, 'filters' | 'setFilter'>): ReactElement {
  const { min, max, step } = RANGE_BOUNDS;

  const commit = useCallback((next: number) => setFilter('minRange', next), [setFilter]);
  const { draft, update, flush } = useSliderDraft(filters.minRange, commit);
  const release = releaseHandlers(flush);

  const pct = ((draft - min) / (max - min)) * 100;
  const cut = draft !== min;
  const selection = cut ? `${miles(draft)} or more` : 'Any range';

  return (
    <div className="slider slider--single">
      <div className="slider__control">
        <div className="slider__track" aria-hidden="true">
          {cut ? <span className="slider__fill" style={{ left: `${pct}%`, right: '0%' }} /> : null}
        </div>
        {/* The upper bound of a "minimum range" filter is fixed by the fleet,
            not by the shopper: it is marked with a terminal tick so the control
            can never be mistaken for a two-handle slider missing a handle. */}
        <span className="slider__cap" aria-hidden="true" />
        <input
          {...release}
          type="range"
          className="slider__input"
          min={min}
          max={max}
          step={step}
          value={draft}
          aria-label="Minimum range"
          aria-valuetext={`${miles(draft)} or more`}
          onChange={(event) => update(Number(event.target.value))}
        />
      </div>

      <p className="slider__caption" aria-hidden="true">
        <span className="slider__value">{selection}</span>
        <span className="slider__scale">
          of {num(min)}–{miles(max)}
        </span>
      </p>
    </div>
  );
}

/* ── Rail ───────────────────────────────────────────────────────────────────*/

export function FilterRail({ filters, setFilter, toggleFilter, reset, activeCount }: FilterRailProps): ReactElement {
  const uid = useId();
  const [open, setOpen] = useState<Record<SectionId, boolean>>(() => {
    const desktop = isDesktopNow();
    return {
      model: true,
      trim: true,
      condition: true,
      price: true,
      range: desktop,
      paint: desktop,
      wheel: desktop,
    };
  });

  const toggleSection = (id: SectionId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  const panelId = (id: SectionId) => `${uid}-${id}`;
  const badgeFor = (key: MultiKey) => (filters[key] as string[]).length || undefined;

  const priceActive = filters.minPrice !== PRICE_BOUNDS.min || filters.maxPrice !== PRICE_BOUNDS.max;
  const rangeActive = filters.minRange !== RANGE_BOUNDS.min;

  return (
    <div className="rail">
      {/* One tally on the page, and it is the results header's. The rail proves
          it governs that number through the per-option counts and the section
          badges, which move on the same frame as the click. */}
      <div className="rail__top">
        <h2 className="rail__title">Filters</h2>
        {activeCount > 0 ? (
          <button
            type="button"
            className="rail__reset"
            onClick={reset}
            aria-label={`Reset all ${activeCount} filters`}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" focusable="false">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <span>Reset all</span>
          </button>
        ) : null}
      </div>

      <Section id="model" title="Model" open={open.model} onToggle={toggleSection} badge={badgeFor('model')} panelId={panelId('model')}>
        <CheckGroup dimension="model" options={MODEL_OPTIONS} filters={filters} toggleFilter={toggleFilter} />
      </Section>

      <Section id="trim" title="Trim" open={open.trim} onToggle={toggleSection} badge={badgeFor('trim')} panelId={panelId('trim')}>
        <CheckGroup dimension="trim" options={TRIM_OPTIONS} filters={filters} toggleFilter={toggleFilter} testIdPrefix="trim-" />
      </Section>

      <Section id="condition" title="Condition" open={open.condition} onToggle={toggleSection} badge={badgeFor('condition')} panelId={panelId('condition')}>
        <CheckGroup dimension="condition" options={CONDITION_OPTIONS} filters={filters} toggleFilter={toggleFilter} />
      </Section>

      <Section id="price" title="Price" open={open.price} onToggle={toggleSection} dot={priceActive} panelId={panelId('price')}>
        <PriceSlider filters={filters} setFilter={setFilter} />
      </Section>

      <Section id="range" title="Range" open={open.range} onToggle={toggleSection} dot={rangeActive} panelId={panelId('range')}>
        <RangeSlider filters={filters} setFilter={setFilter} />
      </Section>

      <Section id="paint" title="Paint" open={open.paint} onToggle={toggleSection} badge={badgeFor('paint')} panelId={panelId('paint')}>
        <PaintGrid filters={filters} toggleFilter={toggleFilter} />
      </Section>

      <Section id="wheel" title="Wheels" open={open.wheel} onToggle={toggleSection} badge={badgeFor('wheel')} panelId={panelId('wheel')}>
        <WheelGrid filters={filters} toggleFilter={toggleFilter} />
      </Section>
    </div>
  );
}

export default FilterRail;
