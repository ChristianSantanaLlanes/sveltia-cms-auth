import { useId, useMemo, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
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

type SectionId = 'model' | 'condition' | 'trim' | 'paint' | 'wheel' | 'price' | 'range';

function Chevron(): ReactElement {
  return (
    <svg className="rail__chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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

interface SectionProps {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: (id: SectionId) => void;
  summary?: string;
  panelId: string;
  children: ReactNode;
}

function Section({ id, title, open, onToggle, summary, panelId, children }: SectionProps): ReactElement {
  return (
    <section className="rail__section" data-open={open || undefined}>
      <h3 className="rail__heading">
        <button
          type="button"
          className="rail__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(id)}
        >
          <span className="rail__toggle-text">{title}</span>
          {!open && summary ? <span className="rail__summary">{summary}</span> : null}
          <Chevron />
        </button>
      </h3>
      <div className="rail__panel" id={panelId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

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

function PaintGrid({ filters, toggleFilter }: Pick<FilterRailProps, 'filters' | 'toggleFilter'>): ReactElement {
  const counts = useMemo(() => facetCounts(filters, 'paint'), [filters]);
  const [hint, setHint] = useState<string | null>(null);
  const selected = filters.paint;

  const caption = hint ?? (selected.length === 0 ? 'Any paint' : `${selected.length} selected`);

  return (
    <div className="swatches">
      <div className="swatches__grid">
        {PAINT_OPTIONS.map((paint) => {
          const count = counts[paint.id] ?? 0;
          const active = selected.includes(paint.id);
          return (
            <button
              key={paint.id}
              type="button"
              className="swatch"
              data-testid={`paint-${paint.id}`}
              aria-pressed={active}
              aria-label={`${paint.name}, ${count} available`}
              style={
                {
                  '--swatch-base': paint.hex,
                  '--swatch-sheen': paint.sheen,
                  '--swatch-shade': paint.shade,
                } as CSSProperties
              }
              onClick={() => toggleFilter('paint', paint.id)}
              onPointerEnter={() => setHint(paint.name)}
              onPointerLeave={() => setHint(null)}
              onFocus={() => setHint(paint.name)}
              onBlur={() => setHint(null)}
            >
              <span className="swatch__disc" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <p className="swatches__caption" aria-hidden="true">
        {caption}
      </p>
    </div>
  );
}

function PriceSlider({ filters, setFilter }: Pick<FilterRailProps, 'filters' | 'setFilter'>): ReactElement {
  const { min, max, step } = PRICE_BOUNDS;
  const span = max - min;
  const lowPct = ((filters.minPrice - min) / span) * 100;
  const highPct = ((filters.maxPrice - min) / span) * 100;

  const setLow = (value: number) => {
    setFilter({ minPrice: Math.min(value, filters.maxPrice - step) });
  };
  const setHigh = (value: number) => {
    setFilter({ maxPrice: Math.max(value, filters.minPrice + step) });
  };

  return (
    <div className="slider">
      <div className="slider__track" aria-hidden="true">
        <span className="slider__fill" style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }} />
      </div>

      <input
        type="range"
        className="slider__input slider__input--low"
        min={min}
        max={max}
        step={step}
        value={filters.minPrice}
        aria-label="Minimum price"
        aria-valuetext={money(filters.minPrice)}
        style={{ zIndex: lowPct > 88 ? 4 : 3 }}
        onChange={(event) => setLow(Number(event.target.value))}
      />
      <input
        type="range"
        className="slider__input slider__input--high"
        min={min}
        max={max}
        step={step}
        value={filters.maxPrice}
        aria-label="Maximum price"
        aria-valuetext={filters.maxPrice === max ? `${money(max)} or more` : money(filters.maxPrice)}
        onChange={(event) => setHigh(Number(event.target.value))}
      />

      <p className="slider__readout">
        <span>{money(filters.minPrice)}</span>
        <span>{filters.maxPrice === max ? `${money(max)}+` : money(filters.maxPrice)}</span>
      </p>
    </div>
  );
}

function RangeSlider({ filters, setFilter }: Pick<FilterRailProps, 'filters' | 'setFilter'>): ReactElement {
  const { min, max, step } = RANGE_BOUNDS;
  const pct = ((filters.minRange - min) / (max - min)) * 100;

  return (
    <div className="slider slider--single">
      <div className="slider__track" aria-hidden="true">
        <span className="slider__fill" style={{ left: `${pct}%`, right: '0%' }} />
      </div>
      <input
        type="range"
        className="slider__input"
        min={min}
        max={max}
        step={step}
        value={filters.minRange}
        aria-label="Minimum range"
        aria-valuetext={`${miles(filters.minRange)} or more`}
        onChange={(event) => setFilter('minRange', Number(event.target.value))}
      />
      <p className="slider__readout">
        <span>{miles(filters.minRange)} or more</span>
        <span>{miles(max)}</span>
      </p>
    </div>
  );
}

export function FilterRail({ filters, setFilter, toggleFilter, reset, activeCount }: FilterRailProps): ReactElement {
  const uid = useId();
  const [open, setOpen] = useState<Record<SectionId, boolean>>(() => {
    const desktop = isDesktopNow();
    return {
      model: true,
      condition: true,
      trim: desktop,
      paint: desktop,
      wheel: desktop,
      price: desktop,
      range: desktop,
    };
  });

  const toggleSection = (id: SectionId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  const panelId = (id: SectionId) => `${uid}-${id}`;

  const summaryFor = (key: MultiKey) => {
    const count = (filters[key] as string[]).length;
    return count ? `${count} selected` : undefined;
  };

  const priceSummary =
    filters.minPrice !== PRICE_BOUNDS.min || filters.maxPrice !== PRICE_BOUNDS.max
      ? `${money(filters.minPrice)} – ${filters.maxPrice === PRICE_BOUNDS.max ? `${money(PRICE_BOUNDS.max)}+` : money(filters.maxPrice)}`
      : undefined;

  const rangeSummary = filters.minRange !== RANGE_BOUNDS.min ? `${miles(filters.minRange)}+` : undefined;

  return (
    <div className="rail">
      <div className="rail__top">
        <h2 className="rail__title">Filters</h2>
        {activeCount > 0 ? (
          <button type="button" className="rail__reset" onClick={reset}>
            Reset all
          </button>
        ) : null}
      </div>

      <Section id="model" title="Model" open={open.model} onToggle={toggleSection} summary={summaryFor('model')} panelId={panelId('model')}>
        <CheckGroup dimension="model" options={MODEL_OPTIONS} filters={filters} toggleFilter={toggleFilter} />
      </Section>

      <Section id="condition" title="Condition" open={open.condition} onToggle={toggleSection} summary={summaryFor('condition')} panelId={panelId('condition')}>
        <CheckGroup dimension="condition" options={CONDITION_OPTIONS} filters={filters} toggleFilter={toggleFilter} />
      </Section>

      <Section id="trim" title="Trim" open={open.trim} onToggle={toggleSection} summary={summaryFor('trim')} panelId={panelId('trim')}>
        <CheckGroup dimension="trim" options={TRIM_OPTIONS} filters={filters} toggleFilter={toggleFilter} testIdPrefix="trim-" />
      </Section>

      <Section id="paint" title="Paint" open={open.paint} onToggle={toggleSection} summary={summaryFor('paint')} panelId={panelId('paint')}>
        <PaintGrid filters={filters} toggleFilter={toggleFilter} />
      </Section>

      <Section id="wheel" title="Wheels" open={open.wheel} onToggle={toggleSection} summary={summaryFor('wheel')} panelId={panelId('wheel')}>
        <CheckGroup
          dimension="wheel"
          options={WHEEL_OPTIONS.map((w) => ({ id: w.id, label: w.name }))}
          filters={filters}
          toggleFilter={toggleFilter}
          testIdPrefix="wheel-"
        />
      </Section>

      <Section id="price" title="Price" open={open.price} onToggle={toggleSection} summary={priceSummary} panelId={panelId('price')}>
        <PriceSlider filters={filters} setFilter={setFilter} />
      </Section>

      <Section id="range" title="Range" open={open.range} onToggle={toggleSection} summary={rangeSummary} panelId={panelId('range')}>
        <RangeSlider filters={filters} setFilter={setFilter} />
      </Section>
    </div>
  );
}

export default FilterRail;
