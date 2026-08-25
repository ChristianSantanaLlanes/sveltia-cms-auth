import type { AddOnOption, CarModel, InteriorOption, PaintOption, WheelOption } from '@/types';

const PAINTS_CORE: PaintOption[] = [
  { id: 'stellar-white', name: 'Stellar White', price: 0, hex: '#e8eaec', sheen: '#ffffff', shade: '#b9bcc0' },
  { id: 'midnight-silver', name: 'Midnight Silver', price: 1500, hex: '#5b6068', sheen: '#9aa1aa', shade: '#33373d', metallic: true },
  { id: 'deep-blue', name: 'Deep Blue Metallic', price: 1500, hex: '#1f3a68', sheen: '#5c86c4', shade: '#111f38', metallic: true },
  { id: 'obsidian', name: 'Obsidian Black', price: 1500, hex: '#15171a', sheen: '#4a4f57', shade: '#000000', metallic: true },
  { id: 'ember-red', name: 'Ember Red', price: 2500, hex: '#9b1116', sheen: '#e04b45', shade: '#5c070b', metallic: true },
  { id: 'quartz-grey', name: 'Quartz Grey', price: 2000, hex: '#8c9095', sheen: '#c9cdd2', shade: '#5a5e64', metallic: true },
];

const WHEELS_SEDAN: WheelOption[] = [
  { id: 'aero-18', name: '18" Aero Wheels', size: 18, price: 0, rangeDelta: 0, style: 'aero' },
  { id: 'sport-19', name: '19" Nova Sport Wheels', size: 19, price: 1500, rangeDelta: -25, style: 'sport' },
  { id: 'arachnid-20', name: '20" Arc Wheels', size: 20, price: 2500, rangeDelta: -41, style: 'arachnid' },
];

const WHEELS_SUV: WheelOption[] = [
  { id: 'gemini-19', name: '19" Gemini Wheels', size: 19, price: 0, rangeDelta: 0, style: 'aero' },
  { id: 'turbine-20', name: '20" Turbine Wheels', size: 20, price: 2000, rangeDelta: -22, style: 'turbine' },
  { id: 'arachnid-22', name: '22" Arc Wheels', size: 22, price: 3500, rangeDelta: -47, style: 'arachnid' },
];

const INTERIORS: InteriorOption[] = [
  { id: 'obsidian-int', name: 'All Black', price: 0, swatch: ['#2b2d31', '#101114'] },
  { id: 'alpine-int', name: 'Black and White', price: 1500, swatch: ['#f2f2f2', '#cfd1d4'] },
  { id: 'cream-int', name: 'Cream', price: 2000, swatch: ['#efe4d2', '#cbbca4'] },
];

const AUTONOMY: AddOnOption[] = [
  {
    id: 'autopilot',
    name: 'Autopilot',
    price: 0,
    group: 'autonomy',
    summary: 'Included as standard on every Vela.',
    bullets: ['Traffic-Aware Cruise Control', 'Autosteer on the highway', 'Emergency lane departure avoidance'],
  },
  {
    id: 'enhanced-autopilot',
    name: 'Enhanced Autopilot',
    price: 6000,
    group: 'autonomy',
    summary: 'Adds navigation, lane changes and parking.',
    bullets: ['Navigate on Autopilot', 'Auto Lane Change', 'Autopark and Summon'],
  },
  {
    id: 'full-autonomy',
    name: 'Full Self-Driving (Supervised)',
    price: 8000,
    group: 'autonomy',
    summary: 'Every Enhanced Autopilot feature, plus city driving.',
    bullets: ['Traffic light and stop sign control', 'Autosteer on city streets', 'All future software updates'],
  },
];

const TOW_SEDAN: AddOnOption = {
  id: 'accessory-bundle',
  name: 'Accessory Bundle',
  price: 850,
  summary: 'All-weather liners, mud flaps and a wall connector.',
  bullets: ['All-Weather Interior Liners', 'Mud Flaps', 'Vela Wall Connector'],
};

const TOW_SUV: AddOnOption = {
  id: 'tow-hitch',
  name: 'Tow Package',
  price: 1200,
  summary: 'Rated to 3,500 lbs with trailer sway control.',
  bullets: ['Class II hitch receiver', 'Trailer sway mitigation', 'Integrated wiring harness'],
};

export const MODELS: CarModel[] = [
  {
    id: 'vela-3',
    name: 'Vela 3',
    shortName: '3',
    tagline: 'The everyday electric sedan',
    body: 'sedan',
    seatsDefault: 5,
    heroHeadline: 'Vela 3',
    heroSub: 'From $299/mo after est. incentives',
    startingPrice: 38990,
    leadTime: 'Est. delivery: Oct — Nov 2026',
    trims: [
      { id: 'rwd', name: 'Rear-Wheel Drive', price: 38990, range: 272, topSpeed: 125, accel: 5.8, drive: 'RWD', peakPower: 283, motors: 1 },
      { id: 'lr-awd', name: 'Long Range All-Wheel Drive', price: 47490, range: 363, topSpeed: 135, accel: 4.2, drive: 'AWD', peakPower: 394, motors: 2 },
      { id: 'performance', name: 'Performance All-Wheel Drive', price: 54990, range: 303, topSpeed: 163, accel: 2.9, drive: 'AWD', peakPower: 510, motors: 2 },
    ],
    paints: PAINTS_CORE,
    wheels: WHEELS_SEDAN,
    interiors: INTERIORS,
    seating: [{ id: 'five', name: 'Five Seat Interior', price: 0, seats: 5 }],
    addOns: [...AUTONOMY, TOW_SEDAN],
    highlights: [
      { label: 'Range (est.)', value: '363', unit: 'mi' },
      { label: '0-60 mph', value: '2.9', unit: 's' },
      { label: 'Top Speed', value: '163', unit: 'mph' },
      { label: 'Peak Power', value: '510', unit: 'hp' },
    ],
  },
  {
    id: 'vela-y',
    name: 'Vela Y',
    shortName: 'Y',
    tagline: 'The most versatile electric SUV',
    body: 'suv',
    seatsDefault: 5,
    heroHeadline: 'Vela Y',
    heroSub: 'From $349/mo after est. incentives',
    startingPrice: 44990,
    leadTime: 'Est. delivery: Sep — Oct 2026',
    trims: [
      { id: 'rwd', name: 'Rear-Wheel Drive', price: 44990, range: 320, topSpeed: 125, accel: 5.9, drive: 'RWD', peakPower: 295, motors: 1 },
      { id: 'lr-awd', name: 'Long Range All-Wheel Drive', price: 50990, range: 352, topSpeed: 135, accel: 4.6, drive: 'AWD', peakPower: 384, motors: 2 },
      { id: 'performance', name: 'Performance All-Wheel Drive', price: 58990, range: 311, topSpeed: 155, accel: 3.5, drive: 'AWD', peakPower: 456, motors: 2 },
    ],
    paints: PAINTS_CORE,
    wheels: WHEELS_SUV,
    interiors: INTERIORS,
    seating: [
      { id: 'five', name: 'Five Seat Interior', price: 0, seats: 5 },
      { id: 'seven', name: 'Seven Seat Interior', price: 2500, seats: 7, availableOn: ['vela-y', 'vela-x'] },
    ],
    addOns: [...AUTONOMY, TOW_SUV],
    highlights: [
      { label: 'Range (est.)', value: '352', unit: 'mi' },
      { label: '0-60 mph', value: '3.5', unit: 's' },
      { label: 'Cargo', value: '76', unit: 'cu ft' },
      { label: 'Peak Power', value: '456', unit: 'hp' },
    ],
  },
  {
    id: 'vela-s',
    name: 'Vela S',
    shortName: 'S',
    tagline: 'Flagship performance sedan',
    body: 'sedan',
    seatsDefault: 5,
    heroHeadline: 'Vela S',
    heroSub: 'Plaid performance. 402 miles of range.',
    startingPrice: 74990,
    leadTime: 'Est. delivery: Nov — Dec 2026',
    trims: [
      { id: 'lr-awd', name: 'Long Range All-Wheel Drive', price: 74990, range: 402, topSpeed: 149, accel: 3.1, drive: 'AWD', peakPower: 670, motors: 2 },
      { id: 'plaid', name: 'Plaid Tri-Motor', price: 89990, range: 359, topSpeed: 200, accel: 1.99, drive: 'AWD', peakPower: 1020, motors: 3 },
    ],
    paints: PAINTS_CORE,
    wheels: WHEELS_SEDAN,
    interiors: INTERIORS,
    seating: [{ id: 'five', name: 'Five Seat Interior', price: 0, seats: 5 }],
    addOns: [...AUTONOMY, TOW_SEDAN],
    highlights: [
      { label: 'Range (est.)', value: '402', unit: 'mi' },
      { label: '0-60 mph', value: '1.99', unit: 's' },
      { label: 'Top Speed', value: '200', unit: 'mph' },
      { label: 'Peak Power', value: '1,020', unit: 'hp' },
    ],
  },
  {
    id: 'vela-x',
    name: 'Vela X',
    shortName: 'X',
    tagline: 'Seven seats. Falcon doors. No compromise.',
    body: 'suv',
    seatsDefault: 5,
    heroHeadline: 'Vela X',
    heroSub: 'Up to seven seats and 3,500 lbs of towing',
    startingPrice: 79990,
    leadTime: 'Est. delivery: Dec 2026 — Jan 2027',
    trims: [
      { id: 'lr-awd', name: 'Long Range All-Wheel Drive', price: 79990, range: 348, topSpeed: 149, accel: 3.8, drive: 'AWD', peakPower: 670, motors: 2 },
      { id: 'plaid', name: 'Plaid Tri-Motor', price: 94990, range: 326, topSpeed: 168, accel: 2.5, drive: 'AWD', peakPower: 1020, motors: 3 },
    ],
    paints: PAINTS_CORE,
    wheels: WHEELS_SUV,
    interiors: INTERIORS,
    seating: [
      { id: 'five', name: 'Five Seat Interior', price: 0, seats: 5 },
      { id: 'six', name: 'Six Seat Interior', price: 6500, seats: 6, availableOn: ['vela-x'] },
      { id: 'seven', name: 'Seven Seat Interior', price: 3500, seats: 7, availableOn: ['vela-y', 'vela-x'] },
    ],
    addOns: [...AUTONOMY, TOW_SUV],
    highlights: [
      { label: 'Range (est.)', value: '348', unit: 'mi' },
      { label: '0-60 mph', value: '2.5', unit: 's' },
      { label: 'Towing', value: '3,500', unit: 'lbs' },
      { label: 'Seats', value: 'Up to 7' },
    ],
  },
];

export const MODEL_BY_ID = Object.fromEntries(MODELS.map((m) => [m.id, m])) as Record<string, CarModel>;

export function getModel(id: string): CarModel | undefined {
  return MODEL_BY_ID[id];
}

export function defaultConfig(modelId: string) {
  const model = MODEL_BY_ID[modelId] ?? MODELS[0];
  return {
    modelId: model.id,
    trimId: model.trims[0].id,
    paintId: model.paints[0].id,
    wheelId: model.wheels[0].id,
    interiorId: model.interiors[0].id,
    seatingId: model.seating[0].id,
    addOnIds: ['autopilot'],
  };
}
