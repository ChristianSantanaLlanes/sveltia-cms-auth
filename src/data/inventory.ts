import { MODELS, MODEL_BY_ID } from '@/data/models';
import { priceConfig } from '@/lib/pricing';
import type { Condition, InventoryVehicle, VehicleConfig } from '@/types';

/** Deterministic PRNG so the catalogue is stable across renders and reloads. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LOCATIONS: { city: string; state: string; distance: number }[] = [
  { city: 'Fremont', state: 'CA', distance: 12 },
  { city: 'Burbank', state: 'CA', distance: 38 },
  { city: 'Costa Mesa', state: 'CA', distance: 64 },
  { city: 'Scottsdale', state: 'AZ', distance: 372 },
  { city: 'Austin', state: 'TX', distance: 1_486 },
  { city: 'Denver', state: 'CO', distance: 1_012 },
  { city: 'Seattle', state: 'WA', distance: 807 },
  { city: 'Miami', state: 'FL', distance: 2_614 },
  { city: 'Chicago', state: 'IL', distance: 2_010 },
  { city: 'Paramus', state: 'NJ', distance: 2_782 },
];

const DELIVERY = ['Oct 4 — Oct 18', 'Oct 12 — Oct 26', 'Nov 1 — Nov 15', 'Nov 8 — Nov 22', 'Dec 2 — Dec 16'];

const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

function vinFor(rand: () => number, year: number) {
  let out = '5YJ';
  for (let i = 0; i < 8; i += 1) out += VIN_CHARS[Math.floor(rand() * VIN_CHARS.length)];
  out += String(year).slice(-1);
  for (let i = 0; i < 6; i += 1) out += VIN_CHARS[Math.floor(rand() * VIN_CHARS.length)];
  return out;
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function buildInventory(count = 84): InventoryVehicle[] {
  const rand = mulberry32(20260825);
  const out: InventoryVehicle[] = [];

  for (let i = 0; i < count; i += 1) {
    const model = MODELS[Math.floor(rand() * MODELS.length)];
    const trim = pick(rand, model.trims);
    const paint = pick(rand, model.paints);
    const wheel = pick(rand, model.wheels);
    const interior = pick(rand, model.interiors);
    const seating = pick(rand, model.seating);

    const addOnIds = ['autopilot'];
    const roll = rand();
    if (roll > 0.78) addOnIds[0] = 'full-autonomy';
    else if (roll > 0.55) addOnIds[0] = 'enhanced-autopilot';

    const config: VehicleConfig = {
      modelId: model.id,
      trimId: trim.id,
      paintId: paint.id,
      wheelId: wheel.id,
      interiorId: interior.id,
      seatingId: seating.id,
      addOnIds,
    };

    const conditionRoll = rand();
    const condition: Condition = conditionRoll > 0.82 ? 'used' : conditionRoll > 0.66 ? 'demo' : 'new';
    const year = condition === 'used' ? 2023 + Math.floor(rand() * 2) : 2026;
    const odometer = condition === 'new' ? Math.floor(rand() * 40) : condition === 'demo' ? 400 + Math.floor(rand() * 3_600) : 8_000 + Math.floor(rand() * 34_000);

    const msrp = priceConfig(config).vehicleSubtotal;
    const discountRate = condition === 'new' ? rand() * 0.03 : condition === 'demo' ? 0.04 + rand() * 0.05 : 0.11 + rand() * 0.12;
    const price = Math.round((msrp * (1 - discountRate)) / 10) * 10;
    const location = pick(rand, LOCATIONS);

    out.push({
      id: `v-${i + 1}`,
      vin: vinFor(rand, year),
      config,
      condition,
      odometer,
      year,
      city: location.city,
      state: location.state,
      distance: location.distance + Math.floor(rand() * 24),
      price,
      msrp,
      savings: msrp - price,
      deliveryWindow: pick(rand, DELIVERY),
      transferable: rand() > 0.35,
      photosAngle: Math.floor(rand() * 3),
    });
  }

  return out;
}

export const INVENTORY = buildInventory();

export function vehicleTitle(v: InventoryVehicle) {
  const model = MODEL_BY_ID[v.config.modelId];
  return `${v.year} ${model.name}`;
}
