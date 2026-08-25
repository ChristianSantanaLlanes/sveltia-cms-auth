import { useEffect, useState, type ReactElement } from 'react';
import Button from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import Select from '@/components/ui/Select';
import Sheet from '@/components/ui/Sheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { num } from '@/lib/format';
import { useOrder } from '@/store/OrderContext';
import FilterRail from './FilterRail';
import VehicleCard from './VehicleCard';
import {
  PRICE_BOUNDS,
  RANGE_BOUNDS,
  SORT_OPTIONS,
  activeChips,
  bestRelaxation,
  useInventoryFilters,
  type FilterChip,
  type SortKey,
} from './useInventoryFilters';
import './InventoryPage.css';

/** Two full rows at the 3-up breakpoint: enough to fill the fold, never a wall. */
const SKELETON_COUNT = 6;

/* ── Loading card ───────────────────────────────────────────────────────────
   The placeholder is the real card with its content withheld, so it is built
   from the card's own classes: the plate keeps its 19:10 aspect and radius, the
   hairline above the spec row stays, the button keeps its pill and its height.
   Every bar is set to the measured width and line-height of the type it stands
   in for — a title is 112px because "2024 Vela 3" measures 112px in the live
   card — so nothing grows, shrinks or reflows at the moment the data lands. Widths are uniform across
   the six cards on purpose: a grid of identical placeholders reads as a system
   waiting, while randomised ones read as content that arrived wrong. */

function LoadingCard(): ReactElement {
  return (
    <article className="vcard vcard--skeleton" aria-hidden="true">
      <div className="vcard__plate">
        <Skeleton className="vcard__plate-skeleton" radius="var(--r-md)" />
        {/* The plate is not the thing that is missing — it is already the right
            surface at the right aspect. The car is. So the plate carries a
            car-shaped mass at the render's own footprint: body, greenhouse and
            two wheels, centred where the render lands. A frame of empty grey
            rectangles is what a page looks like when it fails; a frame of
            car-shaped masses can only be a page that is still loading cars. */}
        <div className="vcard__ghost">
          <Skeleton className="vcard__ghost-cabin" radius="var(--r-pill) var(--r-pill) 0 0" />
          <Skeleton className="vcard__ghost-body" radius="var(--r-pill)" />
          <Skeleton className="vcard__ghost-wheel vcard__ghost-wheel--rear" radius="var(--r-pill)" />
          <Skeleton className="vcard__ghost-wheel vcard__ghost-wheel--front" radius="var(--r-pill)" />
        </div>
      </div>

      <div className="vcard__body">
        <div className="vcard__top">
          <div className="vcard__head">
            <p className="vcard__title">
              <Skeleton w={112} h={24} />
            </p>
            <p className="vcard__trim">
              <Skeleton w={180} h={19} />
            </p>
          </div>

          <div className="vcard__price">
            <p className="vcard__amount">
              <Skeleton w={136} h={32} />
            </p>
            <p className="vcard__monthly">
              <Skeleton w={196} h={19} />
            </p>
          </div>

          <div className="vcard__specs">
            {SPEC_BARS.map(([label, value], index) => (
              <div className="vcard__spec" key={index}>
                <Skeleton w={label} h={13} />
                <Skeleton w={value} h={20} />
              </div>
            ))}
          </div>
        </div>

        <div className="vcard__foot">
          <p className="vcard__meta">
            <Skeleton w={190} h={20} />
          </p>
          <p className="vcard__meta vcard__meta--delivery">
            <Skeleton w={166} h={17} />
          </p>

          <Skeleton w="100%" h={40} radius="var(--r-pill)" className="vcard__cta-skeleton" />
        </div>
      </div>
    </article>
  );
}

/** Measured off the live row: Range / 231 mi, 0–60 mph / 5.8 s, Drive / AWD. */
const SPEC_BARS: [number, number][] = [
  [44, 58],
  [64, 42],
  [38, 42],
];

const plural = (n: number) => `${num(n)} ${n === 1 ? 'result' : 'results'}`;

export default function InventoryPage(): ReactElement {
  const { filters, setFilter, toggleFilter, reset, activeCount, results, pendingCount, isLoading } =
    useInventoryFilters();
  const { zip } = useOrder();

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!isLoading) setSettled(true);
  }, [isLoading]);

  // The rail lives in the sheet below 1024px; never leave it open behind a resize.
  useEffect(() => {
    if (isDesktop) setSheetOpen(false);
  }, [isDesktop]);

  /* Two different waits, two different treatments. Nothing has ever been drawn
     on a first load, so the grid is filled with skeleton cards that hold the
     exact box of the real ones. A re-filter already has cards on screen, so
     they simply dim and are replaced — swapping them for skeletons would throw
     the page away and rebuild it for a quarter of a second. */
  const showSkeletons = isLoading && !settled;
  const fading = isLoading && settled;

  const chips = activeChips(filters);
  const isEmpty = !showSkeletons && results.length === 0;
  /* The one filter that, lifted on its own, brings stock back — offered beside
     the reset so the way out does not have to cost the whole search. */
  const relaxation = isEmpty ? bestRelaxation(filters) : null;

  const removeChip = (chip: FilterChip) => {
    if (chip.key === 'price') {
      setFilter({ minPrice: PRICE_BOUNDS.min, maxPrice: PRICE_BOUNDS.max });
      return;
    }
    if (chip.key === 'range') {
      setFilter('minRange', RANGE_BOUNDS.min);
      return;
    }
    toggleFilter(chip.key, chip.id);
  };

  const rail = (
    <div id="inventory-filters">
      <FilterRail
        filters={filters}
        setFilter={setFilter}
        toggleFilter={toggleFilter}
        reset={reset}
        activeCount={activeCount}
      />
    </div>
  );

  const chipList = (className: string) => (
    <ul className={className}>
      {chips.map((chip) => (
        <li key={`${chip.key}-${chip.id}`}>
          <button
            type="button"
            className="inv__chip"
            onClick={() => removeChip(chip)}
            aria-label={`Remove filter: ${chip.label}`}
          >
            <span>{chip.label}</span>
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );

  const sortSelect = (
    <Select
      label="Sort by"
      hideLabel
      value={filters.sort}
      options={SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
      onChange={(event) => setFilter('sort', event.target.value as SortKey)}
    />
  );

  return (
    <div className="inv">
      <h1 className="sr-only">Vela inventory</h1>

      {isDesktop ? null : (
        <div className="inv__bar">
          <button
            type="button"
            className="inv__filter-btn"
            data-testid="filter-toggle"
            aria-expanded={sheetOpen}
            aria-controls="inventory-filters"
            onClick={() => setSheetOpen(true)}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
              <path
                d="M1.5 3.5h13M3.5 8h9M6 12.5h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <span>Filters</span>
            {activeCount > 0 ? <span className="inv__filter-count">({activeCount})</span> : null}
          </button>
          {sortSelect}
        </div>
      )}

      <div className="inv__shell">
        {isDesktop ? (
          <aside className="inv__rail" aria-label="Filter inventory">
            {rail}
          </aside>
        ) : null}

        <section className="inv__results" aria-label="Vehicles">
          <header className="inv__header">
            <div className="inv__headline">
              <p className="inv__eyebrow">Vela Inventory</p>
              {/* The count is computed on the click, not after the fetch, so it
                  never lags the rail and never leaves a grey bar where a number
                  belongs. */}
              <p className="inv__count" data-testid="result-count">
                <span className="inv__count-value" key={pendingCount}>
                  {plural(pendingCount)}
                </span>
              </p>
              <p className="inv__location">
                <span className="inv__location-wide">
                  New, demo and pre-owned Vela vehicles, delivered to {zip}
                </span>
                <span className="inv__location-narrow">Delivered to {zip}</span>
              </p>
            </div>
            {isDesktop ? (
              <div className="inv__header-sort">
                <span className="inv__sort-label" aria-hidden="true">
                  Sort by
                </span>
                {sortSelect}
              </div>
            ) : null}
          </header>

          <p className="sr-only" role="status" aria-live="polite">
            {isLoading ? 'Loading vehicles' : `${plural(pendingCount)} match your filters`}
          </p>

          {chips.length > 0 && !isEmpty ? (
            /* One reset for the whole view. On desktop that is the rail's own
               "Reset all"; the chips here remove a single filter each. Below
               1024px the rail is behind the sheet, so the clear-all lives here
               instead — it is never offered twice on one screen. */
            <div className="inv__active">
              {chipList('inv__chips')}
              {isDesktop ? null : (
                <button type="button" className="inv__clear" onClick={reset}>
                  Clear all
                </button>
              )}
            </div>
          ) : null}

          {isEmpty ? (
            /* A filtered view that returned zero rows is still that view, not an
               error screen: the block starts at the results column's own left
               edge, directly under the header rule, and stays below the "0
               results" in the hierarchy instead of restating it at headline
               scale. Sentence, one line of help, the filters that caused it as
               removable chips, one solid way out. */
            <div className="inv__empty" data-fading={fading || undefined}>
              <p className="inv__empty-title">Nothing in stock matches these filters.</p>
              <p className="inv__empty-body">
                Every Vela is also built to order. Remove a filter below to see what is ready to
                deliver near {zip}.
              </p>

              {chips.length > 0 ? (
                <>
                  {chipList('inv__chips inv__chips--empty')}
                  <div className="inv__empty-actions">
                    <Button variant="primary" onClick={reset}>
                      Clear all filters
                    </Button>
                    {relaxation ? (
                      <Button variant="secondary" onClick={() => removeChip(relaxation.chip)}>
                        {relaxation.label}
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="inv__empty-actions">
                  <Button variant="primary" to="/design/vela-3">
                    Build one to order
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="inv__grid" data-fading={fading || undefined} aria-busy={isLoading || undefined}>
              {showSkeletons
                ? Array.from({ length: SKELETON_COUNT }, (_, index) => <LoadingCard key={index} />)
                : results.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
            </div>
          )}
        </section>
      </div>

      {isDesktop ? null : (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filters">
          {rail}
          <div className="inv__sheet-actions">
            <Button variant="primary" fullWidth onClick={() => setSheetOpen(false)}>
              {`Show ${plural(pendingCount)}`}
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
