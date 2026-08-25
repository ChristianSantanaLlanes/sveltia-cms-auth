import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { INVENTORY } from '@/data/inventory';
import { MODELS } from '@/data/models';
import { effectiveRange } from '@/lib/pricing';
import { miles, money, num } from '@/lib/format';
import type { Condition, InventoryVehicle, PaintOption, WheelOption } from '@/types';

/* ── Vocabulary ─────────────────────────────────────────────────────────────
 *
 * Every filter lives in the query string so a filtered view is shareable:
 *   /inventory?model=vela-3,vela-s&condition=new&paint=obsidian&maxPrice=60000
 *
 * Multi-select dimensions are comma-joined; numeric dimensions are omitted from
 * the URL whenever they sit at their bound, so a default view has a clean URL.
 * `?slow=1` stretches the simulated fetch to 1.8s — it exists so the loading and
 * transition states can be captured, and nothing else reads it.
 * ---------------------------------------------------------------------------*/

export type SortKey = 'price-asc' | 'price-desc' | 'range-desc' | 'delivery' | 'distance';

/** Dimensions that hold a list of ids. */
export type MultiKey = 'model' | 'condition' | 'trim' | 'paint' | 'wheel';

/** Every dimension a chip can represent (numeric ranges collapse to one chip). */
export type ChipKey = MultiKey | 'price' | 'range';

export interface InventoryFilters {
  model: string[];
  condition: Condition[];
  trim: string[];
  paint: string[];
  wheel: string[];
  minPrice: number;
  maxPrice: number;
  minRange: number;
  sort: SortKey;
  slow: boolean;
}

export interface FacetOption {
  id: string;
  label: string;
}

export interface FilterChip {
  key: ChipKey;
  id: string;
  label: string;
}

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'range-desc', label: 'Range: High to Low' },
  { value: 'delivery', label: 'Earliest Delivery' },
  { value: 'distance', label: 'Nearest First' },
];

const DEFAULT_SORT: SortKey = 'price-asc';
const SORT_KEYS = SORT_OPTIONS.map((o) => o.value);

/* ── Option catalogues, derived from what is actually in stock ───────────────*/

const inStock = <T,>(items: T[], has: (item: T) => boolean) => items.filter(has);

const MODEL_IDS = new Set(INVENTORY.map((v) => v.config.modelId));
const TRIM_IDS = new Set(INVENTORY.map((v) => v.config.trimId));
const PAINT_IDS = new Set(INVENTORY.map((v) => v.config.paintId));
const WHEEL_IDS = new Set(INVENTORY.map((v) => v.config.wheelId));

export const MODEL_OPTIONS: FacetOption[] = inStock(MODELS, (m) => MODEL_IDS.has(m.id)).map((m) => ({
  id: m.id,
  label: m.name,
}));

export const CONDITION_OPTIONS: FacetOption[] = [
  { id: 'new', label: 'New' },
  { id: 'demo', label: 'Demo' },
  { id: 'used', label: 'Used' },
];

function uniqueBy<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export const TRIM_OPTIONS: FacetOption[] = inStock(
  uniqueBy(MODELS.flatMap((m) => m.trims)),
  (t) => TRIM_IDS.has(t.id),
).map((t) => ({ id: t.id, label: t.name }));

export const PAINT_OPTIONS: PaintOption[] = inStock(
  uniqueBy(MODELS.flatMap((m) => m.paints)),
  (p) => PAINT_IDS.has(p.id),
);

export const WHEEL_OPTIONS: WheelOption[] = inStock(
  uniqueBy(MODELS.flatMap((m) => m.wheels)),
  (w) => WHEEL_IDS.has(w.id),
).sort((a, b) => a.size - b.size);

const LABEL_BY_ID: Record<MultiKey, Record<string, string>> = {
  model: Object.fromEntries(MODEL_OPTIONS.map((o) => [o.id, o.label])),
  condition: Object.fromEntries(CONDITION_OPTIONS.map((o) => [o.id, o.label])),
  trim: Object.fromEntries(TRIM_OPTIONS.map((o) => [o.id, o.label])),
  paint: Object.fromEntries(PAINT_OPTIONS.map((o) => [o.id, o.name])),
  wheel: Object.fromEntries(WHEEL_OPTIONS.map((o) => [o.id, o.name])),
};

const VALID_IDS: Record<MultiKey, Set<string>> = {
  model: new Set(Object.keys(LABEL_BY_ID.model)),
  condition: new Set(Object.keys(LABEL_BY_ID.condition)),
  trim: new Set(Object.keys(LABEL_BY_ID.trim)),
  paint: new Set(Object.keys(LABEL_BY_ID.paint)),
  wheel: new Set(Object.keys(LABEL_BY_ID.wheel)),
};

/** Canonical display order, so toggling never scrambles the chip row. */
const ORDER: Record<MultiKey, string[]> = {
  model: MODEL_OPTIONS.map((o) => o.id),
  condition: CONDITION_OPTIONS.map((o) => o.id),
  trim: TRIM_OPTIONS.map((o) => o.id),
  paint: PAINT_OPTIONS.map((o) => o.id),
  wheel: WHEEL_OPTIONS.map((o) => o.id),
};

/* ── Bounds and per-vehicle derived values (computed once) ───────────────────*/

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function deliveryRank(window: string): number {
  const match = /^\s*([A-Za-z]{3})\s+(\d{1,2})/.exec(window);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const month = MONTHS.indexOf(match[1]);
  if (month < 0) return Number.MAX_SAFE_INTEGER;
  return month * 100 + Number(match[2]);
}

interface Derived {
  range: number;
  delivery: number;
  order: number;
}

const DERIVED: Record<string, Derived> = {};
INVENTORY.forEach((v, index) => {
  DERIVED[v.id] = {
    range: effectiveRange(v.config),
    delivery: deliveryRank(v.deliveryWindow),
    order: index,
  };
});

const floorTo = (n: number, step: number) => Math.floor(n / step) * step;
const ceilTo = (n: number, step: number) => Math.ceil(n / step) * step;

export const PRICE_BOUNDS = {
  min: floorTo(Math.min(...INVENTORY.map((v) => v.price)), 1000),
  max: ceilTo(Math.max(...INVENTORY.map((v) => v.price)), 1000),
  step: 500,
};

export const RANGE_BOUNDS = {
  min: floorTo(Math.min(...INVENTORY.map((v) => DERIVED[v.id].range)), 10),
  max: ceilTo(Math.max(...INVENTORY.map((v) => DERIVED[v.id].range)), 10),
  step: 5,
};

export const DEFAULT_FILTERS: InventoryFilters = {
  model: [],
  condition: [],
  trim: [],
  paint: [],
  wheel: [],
  minPrice: PRICE_BOUNDS.min,
  maxPrice: PRICE_BOUNDS.max,
  minRange: RANGE_BOUNDS.min,
  sort: DEFAULT_SORT,
  slow: false,
};

/* ── URL <-> filters ────────────────────────────────────────────────────────*/

function readList(params: URLSearchParams, key: MultiKey): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  const wanted = new Set(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter((part) => VALID_IDS[key].has(part)),
  );
  return ORDER[key].filter((id) => wanted.has(id));
}

function readNumber(params: URLSearchParams, key: string, fallback: number, lo: number, hi: number): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(parsed)));
}

function parseFilters(params: URLSearchParams): InventoryFilters {
  const minPrice = readNumber(params, 'minPrice', PRICE_BOUNDS.min, PRICE_BOUNDS.min, PRICE_BOUNDS.max);
  const maxPrice = readNumber(params, 'maxPrice', PRICE_BOUNDS.max, PRICE_BOUNDS.min, PRICE_BOUNDS.max);
  const sortRaw = params.get('sort') as SortKey | null;

  return {
    model: readList(params, 'model'),
    condition: readList(params, 'condition') as Condition[],
    trim: readList(params, 'trim'),
    paint: readList(params, 'paint'),
    wheel: readList(params, 'wheel'),
    minPrice: Math.min(minPrice, maxPrice),
    maxPrice: Math.max(minPrice, maxPrice),
    minRange: readNumber(params, 'minRange', RANGE_BOUNDS.min, RANGE_BOUNDS.min, RANGE_BOUNDS.max),
    sort: sortRaw && SORT_KEYS.includes(sortRaw) ? sortRaw : DEFAULT_SORT,
    slow: params.get('slow') === '1',
  };
}

const MULTI_KEYS: MultiKey[] = ['model', 'condition', 'trim', 'paint', 'wheel'];

function writeParams(params: URLSearchParams, patch: Partial<InventoryFilters>): URLSearchParams {
  const next = new URLSearchParams(params);

  for (const key of MULTI_KEYS) {
    const value = patch[key];
    if (!value) continue;
    const cleaned = ORDER[key].filter((id) => (value as string[]).includes(id));
    if (cleaned.length) next.set(key, cleaned.join(','));
    else next.delete(key);
  }

  const numeric: [keyof InventoryFilters, string, number][] = [
    ['minPrice', 'minPrice', PRICE_BOUNDS.min],
    ['maxPrice', 'maxPrice', PRICE_BOUNDS.max],
    ['minRange', 'minRange', RANGE_BOUNDS.min],
  ];
  for (const [key, param, dflt] of numeric) {
    const value = patch[key];
    if (typeof value !== 'number') continue;
    if (value === dflt) next.delete(param);
    else next.set(param, String(value));
  }

  if (patch.sort !== undefined) {
    if (patch.sort === DEFAULT_SORT) next.delete('sort');
    else next.set('sort', patch.sort);
  }

  if (patch.slow !== undefined) {
    if (patch.slow) next.set('slow', '1');
    else next.delete('slow');
  }

  return next;
}

/* ── Matching, faceting, sorting ────────────────────────────────────────────*/

function matches(v: InventoryVehicle, f: InventoryFilters, skip?: ChipKey): boolean {
  if (skip !== 'model' && f.model.length && !f.model.includes(v.config.modelId)) return false;
  if (skip !== 'condition' && f.condition.length && !f.condition.includes(v.condition)) return false;
  if (skip !== 'trim' && f.trim.length && !f.trim.includes(v.config.trimId)) return false;
  if (skip !== 'paint' && f.paint.length && !f.paint.includes(v.config.paintId)) return false;
  if (skip !== 'wheel' && f.wheel.length && !f.wheel.includes(v.config.wheelId)) return false;
  if (skip !== 'price' && (v.price < f.minPrice || v.price > f.maxPrice)) return false;
  if (skip !== 'range' && DERIVED[v.id].range < f.minRange) return false;
  return true;
}

const DIMENSION_VALUE: Record<MultiKey, (v: InventoryVehicle) => string> = {
  model: (v) => v.config.modelId,
  condition: (v) => v.condition,
  trim: (v) => v.config.trimId,
  paint: (v) => v.config.paintId,
  wheel: (v) => v.config.wheelId,
};

/**
 * How many vehicles a given option would return if it were the only choice made
 * in its own dimension — the count a shopper expects next to a checkbox.
 */
export function facetCounts(filters: InventoryFilters, dimension: MultiKey): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ORDER[dimension]) counts[id] = 0;
  for (const v of INVENTORY) {
    if (!matches(v, filters, dimension)) continue;
    const id = DIMENSION_VALUE[dimension](v);
    if (id in counts) counts[id] += 1;
  }
  return counts;
}

/** Total catalogue size — the denominator the rail shows next to the live count. */
export const INVENTORY_TOTAL = INVENTORY.length;

/**
 * How many vehicles the current filters match, computed synchronously. The rail
 * reads this so the count reacts on the same frame as the click, while the grid
 * catches up behind the cross-fade.
 */
export function matchCount(filters: InventoryFilters): number {
  let n = 0;
  for (const v of INVENTORY) if (matches(v, filters)) n += 1;
  return n;
}

const COMPARATORS: Record<SortKey, (a: InventoryVehicle, b: InventoryVehicle) => number> = {
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  'range-desc': (a, b) => DERIVED[b.id].range - DERIVED[a.id].range,
  delivery: (a, b) => DERIVED[a.id].delivery - DERIVED[b.id].delivery,
  distance: (a, b) => a.distance - b.distance,
};

function filterAndSort(filters: InventoryFilters): InventoryVehicle[] {
  const compare = COMPARATORS[filters.sort] ?? COMPARATORS[DEFAULT_SORT];
  return INVENTORY.filter((v) => matches(v, filters)).sort(
    (a, b) => compare(a, b) || DERIVED[a.id].order - DERIVED[b.id].order,
  );
}

/** One removable chip per active choice, in dimension order. */
export function activeChips(filters: InventoryFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const key of MULTI_KEYS) {
    for (const id of filters[key] as string[]) {
      chips.push({ key, id, label: LABEL_BY_ID[key][id] ?? id });
    }
  }
  const lowAtBound = filters.minPrice === PRICE_BOUNDS.min;
  const highAtBound = filters.maxPrice === PRICE_BOUNDS.max;
  if (!lowAtBound || !highAtBound) {
    // Read the way a shopper would say it: only name the bound they actually moved.
    const label = lowAtBound
      ? `Up to ${money(filters.maxPrice)}`
      : highAtBound
        ? `${money(filters.minPrice)} and up`
        : `${money(filters.minPrice)} – ${money(filters.maxPrice)}`;
    chips.push({ key: 'price', id: 'price', label });
  }
  if (filters.minRange !== RANGE_BOUNDS.min) {
    chips.push({ key: 'range', id: 'range', label: `${miles(filters.minRange)}+ range` });
  }
  return chips;
}

/* ── The nearest way out of a dead end ──────────────────────────────────────
 *
 * Zero results is almost always one filter's fault. Rather than offering only
 * the scorched-earth "clear everything", the empty state names the single
 * constraint that, dropped on its own, brings stock back — and says how much.
 * Dimensions are tried in order of how little they say about what the shopper
 * actually wants: a price ceiling is a budget guess, a model is a decision. */

const RELAX_ORDER: ChipKey[] = ['price', 'range', 'wheel', 'paint', 'condition', 'trim', 'model'];

/** Sentence tail for the button: "Show 24 at any price". */
const RELAX_PHRASE: Record<ChipKey, string> = {
  price: 'at any price',
  range: 'at any range',
  model: 'across all models',
  condition: 'in any condition',
  trim: 'in any trim',
  paint: 'in any paint',
  wheel: 'on any wheel',
};

export interface Relaxation {
  chip: FilterChip;
  count: number;
  /** Ready-to-set label, e.g. "Show 24 at any price". */
  label: string;
}

/** The same filters with one chip's constraint lifted. */
function withoutChip(filters: InventoryFilters, chip: FilterChip): InventoryFilters {
  if (chip.key === 'price') {
    return { ...filters, minPrice: PRICE_BOUNDS.min, maxPrice: PRICE_BOUNDS.max };
  }
  if (chip.key === 'range') {
    return { ...filters, minRange: RANGE_BOUNDS.min };
  }
  const kept = (filters[chip.key] as string[]).filter((id) => id !== chip.id);
  return { ...filters, [chip.key]: kept };
}

export function bestRelaxation(filters: InventoryFilters): Relaxation | null {
  const chips = activeChips(filters);
  if (chips.length < 2) return null; // With one filter active, "clear all" already is this.
  let best: Relaxation | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const chip of chips) {
    const count = matchCount(withoutChip(filters, chip));
    if (count === 0) continue;
    const rank = RELAX_ORDER.indexOf(chip.key);
    if (rank > bestRank || (rank === bestRank && best && count <= best.count)) continue;
    bestRank = rank;
    best = { chip, count, label: `Show ${num(count)} ${RELAX_PHRASE[chip.key]}` };
  }
  return best;
}

export function countActive(filters: InventoryFilters): number {
  return activeChips(filters).length;
}

/* ── Simulated latency ──────────────────────────────────────────────────────*/

const FIRST_LOAD_MS = 450;
const REFILTER_MS = 250;
const SLOW_MS = 1800;

export interface SetFilter {
  <K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]): void;
  (patch: Partial<InventoryFilters>): void;
}

export interface UseInventoryFilters {
  filters: InventoryFilters;
  setFilter: SetFilter;
  toggleFilter: (key: MultiKey, id: string) => void;
  reset: () => void;
  activeCount: number;
  results: InventoryVehicle[];
  /**
   * How many vehicles the current filters match, known on the same frame as the
   * click. The header count reads this rather than `results.length` so the
   * number is never behind the filter rail's own count, and so a loading frame
   * still states how many cards are on their way — a skeleton grid under a real
   * count is unmistakably a page mid-load rather than a page that failed.
   */
  pendingCount: number;
  isLoading: boolean;
}

export function useInventoryFilters(): UseInventoryFilters {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  /* React Router commits a navigation in a transition, so two clicks landing in
     the same frame both read the pre-click query string and the second write
     drops the first — tick two paint chips quickly and one silently fails to
     take. Patches are layered onto the last params we asked for until the
     router catches up, then the queue is dropped. */
  const queued = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    queued.current = null;
  }, [searchParams]);

  const apply = useCallback(
    (patch: Partial<InventoryFilters>) => {
      const next = writeParams(queued.current ?? searchParams, patch);
      queued.current = next;
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setFilter = useCallback(
    (keyOrPatch: keyof InventoryFilters | Partial<InventoryFilters>, value?: unknown) => {
      if (typeof keyOrPatch === 'string') {
        apply({ [keyOrPatch]: value } as Partial<InventoryFilters>);
        return;
      }
      apply(keyOrPatch);
    },
    [apply],
  ) as SetFilter;

  const toggleFilter = useCallback(
    (key: MultiKey, id: string) => {
      const current = readList(queued.current ?? searchParams, key);
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      apply({ [key]: next } as Partial<InventoryFilters>);
    },
    [apply, searchParams],
  );

  const reset = useCallback(() => {
    const prev = queued.current ?? searchParams;
    const next = new URLSearchParams();
    // The sort choice and the screenshot flag are not filters; they survive a reset.
    const sort = prev.get('sort');
    if (sort) next.set('sort', sort);
    if (prev.get('slow') === '1') next.set('slow', '1');
    queued.current = next;
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const pending = useMemo(() => filterAndSort(filters), [filters]);

  const [results, setResults] = useState<InventoryVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const settledOnce = useRef(false);

  useEffect(() => {
    const delay = filters.slow ? SLOW_MS : settledOnce.current ? REFILTER_MS : FIRST_LOAD_MS;
    setIsLoading(true);
    const timer = window.setTimeout(() => {
      settledOnce.current = true;
      setResults(pending);
      setIsLoading(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [pending, filters.slow]);

  const activeCount = useMemo(() => countActive(filters), [filters]);

  return { filters, setFilter, toggleFilter, reset, activeCount, results, pendingCount: pending.length, isLoading };
}

export default useInventoryFilters;
