export type ModelId = 'vela-3' | 'vela-y' | 'vela-s' | 'vela-x';
export type BodyStyle = 'sedan' | 'suv';
export type Condition = 'new' | 'demo' | 'used';
export type PaymentMode = 'cash' | 'finance' | 'lease';

export interface Trim {
  id: string;
  name: string;
  price: number;
  range: number;        // EPA est. miles
  topSpeed: number;     // mph
  accel: number;        // 0-60 mph seconds
  drive: 'RWD' | 'AWD';
  peakPower: number;    // hp
  motors: 1 | 2 | 3;
}

export interface PaintOption {
  id: string;
  name: string;
  price: number;
  /** Base body colour */
  hex: string;
  /** Highlight used for the specular sheen on the render */
  sheen: string;
  /** Deep shade used in the lower body gradient */
  shade: string;
  metallic?: boolean;
}

export interface WheelOption {
  id: string;
  name: string;
  size: number;         // inches
  price: number;
  rangeDelta: number;   // miles added/removed
  /** Which SVG rim design to draw */
  style: 'aero' | 'sport' | 'turbine' | 'arachnid';
}

export interface InteriorOption {
  id: string;
  name: string;
  price: number;
  /** Swatch gradient stops */
  swatch: [string, string];
}

export interface SeatingOption {
  id: string;
  name: string;
  price: number;
  seats: number;
  availableOn?: ModelId[];
}

export interface AddOnOption {
  id: string;
  name: string;
  price: number;
  summary: string;
  bullets: string[];
  /** Mutually exclusive group; only one option per group can be active */
  group?: 'autonomy';
}

export interface CarModel {
  id: ModelId;
  name: string;             // "Vela 3"
  shortName: string;        // "3"
  tagline: string;
  body: BodyStyle;
  seatsDefault: number;
  heroHeadline: string;
  heroSub: string;
  startingPrice: number;
  leadTime: string;         // "Est. delivery: Mar 2026"
  trims: Trim[];
  paints: PaintOption[];
  wheels: WheelOption[];
  interiors: InteriorOption[];
  seating: SeatingOption[];
  addOns: AddOnOption[];
  highlights: { label: string; value: string; unit?: string }[];
}

export interface VehicleConfig {
  modelId: ModelId;
  trimId: string;
  paintId: string;
  wheelId: string;
  interiorId: string;
  seatingId: string;
  addOnIds: string[];
}

export interface InventoryVehicle {
  id: string;
  vin: string;
  config: VehicleConfig;
  condition: Condition;
  odometer: number;         // miles
  year: number;
  city: string;
  state: string;
  distance: number;         // miles from the shopper
  price: number;            // as-configured asking price
  msrp: number;
  savings: number;
  deliveryWindow: string;
  transferable: boolean;
  photosAngle: number;      // deterministic hero angle seed
}

export interface PriceBreakdownLine {
  id: string;
  label: string;
  detail?: string;
  amount: number;
}

export interface PriceBreakdown {
  lines: PriceBreakdownLine[];
  vehicleSubtotal: number;
  destinationFee: number;
  orderFee: number;
  incentives: number;
  purchasePrice: number;
  dueToday: number;
  financeMonthly: number;
  leaseMonthly: number;
  savingsPerMonth: number;
}
