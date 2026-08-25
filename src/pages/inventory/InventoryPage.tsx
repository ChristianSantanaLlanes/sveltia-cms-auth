import { useEffect, useState, type ReactElement } from 'react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Sheet from '@/components/ui/Sheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { num } from '@/lib/format';
import { useOrder } from '@/store/OrderContext';
import FilterRail from './FilterRail';
import VehicleCard, { VehicleCardSkeleton } from './VehicleCard';
import {
  PRICE_BOUNDS,
  RANGE_BOUNDS,
  SORT_OPTIONS,
  activeChips,
  useInventoryFilters,
  type FilterChip,
  type SortKey,
} from './useInventoryFilters';
import './InventoryPage.css';

/** Two full rows at the 3-up breakpoint: enough to fill the fold, never a wall. */
const SKELETON_COUNT = 6;

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
              <p className="inv__count">
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
            <div className="inv__active">
              {chipList('inv__chips')}
              <button type="button" className="inv__clear" onClick={reset}>
                Clear all
              </button>
            </div>
          ) : null}

          {isEmpty ? (
            <div className="inv__empty" data-fading={fading || undefined}>
              <div className="inv__empty-inner">
                <p className="inv__empty-title">Nothing in stock matches this search.</p>
                <p className="inv__empty-body">
                  Every Vela is also built to order. Drop a filter below to see what is ready to deliver
                  near {zip} today.
                </p>

                {chips.length > 0 ? (
                  <div className="inv__empty-filters">
                    <p className="inv__empty-label">Filters applied</p>
                    {chipList('inv__chips inv__chips--empty')}
                    <Button variant="primary" onClick={reset} className="inv__empty-reset">
                      Clear all filters
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="inv__grid" data-fading={fading || undefined} aria-busy={isLoading || undefined}>
              {showSkeletons
                ? Array.from({ length: SKELETON_COUNT }, (_, index) => <VehicleCardSkeleton key={index} />)
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
