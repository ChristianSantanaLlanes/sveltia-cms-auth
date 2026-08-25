import { useEffect, useState, type ReactElement } from 'react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Sheet from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
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

const SKELETON_COUNT = 6;

export default function InventoryPage(): ReactElement {
  const { filters, setFilter, toggleFilter, reset, activeCount, results, isLoading } = useInventoryFilters();
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

  const showSkeletons = isLoading && !settled;
  const fading = isLoading && settled;
  const chips = activeChips(filters);

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
              <p className="inv__count" role="status" aria-live="polite">
                {showSkeletons ? (
                  <Skeleton w={168} h={34} />
                ) : (
                  `${num(results.length)} ${results.length === 1 ? 'result' : 'results'}`
                )}
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

          {chips.length > 0 && results.length > 0 ? (
            <div className="inv__active">
              {chipList('inv__chips')}
              <button type="button" className="inv__clear" onClick={reset}>
                Clear all
              </button>
            </div>
          ) : null}

          {!showSkeletons && results.length === 0 ? (
            <div className="inv__empty">
              <p className="inv__empty-title">No vehicles match these filters.</p>
              <p className="inv__empty-body">
                Widen your price range or clear a filter to see everything we have in stock.
              </p>
              {chips.length > 0 ? chipList('inv__chips inv__chips--empty') : null}
              <Button variant="secondary" onClick={reset} className="inv__empty-reset">
                Reset filters
              </Button>
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
              {isLoading
                ? 'Updating results'
                : `Show ${num(results.length)} ${results.length === 1 ? 'result' : 'results'}`}
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
