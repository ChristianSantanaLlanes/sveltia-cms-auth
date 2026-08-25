import { MODEL_BY_ID } from '@/data/models';
import type { PriceBreakdown, PriceBreakdownLine, VehicleConfig } from '@/types';

export const DESTINATION_FEE = 1390;
export const ORDER_FEE = 250;
export const FEDERAL_INCENTIVE = 7500;
export const DOWN_PAYMENT_RATE = 0.1;
export const APR = 0.0549;
export const TERM_MONTHS = 72;
export const LEASE_TERM = 36;
export const LEASE_RESIDUAL = 0.55;
export const LEASE_MF = 0.00185;
export const GAS_SAVINGS_PER_MONTH = 118;

export function resolveConfig(config: VehicleConfig) {
  const model = MODEL_BY_ID[config.modelId];
  if (!model) throw new Error(`Unknown model: ${config.modelId}`);
  const trim = model.trims.find((t) => t.id === config.trimId) ?? model.trims[0];
  const paint = model.paints.find((p) => p.id === config.paintId) ?? model.paints[0];
  const wheel = model.wheels.find((w) => w.id === config.wheelId) ?? model.wheels[0];
  const interior = model.interiors.find((i) => i.id === config.interiorId) ?? model.interiors[0];
  const seating = model.seating.find((s) => s.id === config.seatingId) ?? model.seating[0];
  const addOns = model.addOns.filter((a) => config.addOnIds.includes(a.id));
  return { model, trim, paint, wheel, interior, seating, addOns };
}

/** Range after wheel penalty. */
export function effectiveRange(config: VehicleConfig): number {
  const { trim, wheel } = resolveConfig(config);
  return Math.max(0, trim.range + wheel.rangeDelta);
}

export function monthlyPayment(principal: number, apr: number, months: number): number {
  const r = apr / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function priceConfig(config: VehicleConfig): PriceBreakdown {
  const { model, trim, paint, wheel, interior, seating, addOns } = resolveConfig(config);

  const lines: PriceBreakdownLine[] = [
    { id: 'trim', label: `${model.name} ${trim.name}`, amount: trim.price },
  ];
  if (paint.price) lines.push({ id: 'paint', label: paint.name, amount: paint.price });
  if (wheel.price) lines.push({ id: 'wheels', label: wheel.name, amount: wheel.price });
  if (interior.price) lines.push({ id: 'interior', label: interior.name, amount: interior.price });
  if (seating.price) lines.push({ id: 'seating', label: seating.name, amount: seating.price });
  for (const a of addOns) if (a.price) lines.push({ id: a.id, label: a.name, amount: a.price });

  const vehicleSubtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const purchasePrice = vehicleSubtotal + DESTINATION_FEE + ORDER_FEE - FEDERAL_INCENTIVE;

  const down = Math.round(purchasePrice * DOWN_PAYMENT_RATE);
  const financeMonthly = monthlyPayment(purchasePrice - down, APR, TERM_MONTHS);

  const capCost = vehicleSubtotal + DESTINATION_FEE;
  const residual = capCost * LEASE_RESIDUAL;
  const leaseMonthly = (capCost - residual) / LEASE_TERM + (capCost + residual) * LEASE_MF;

  return {
    lines,
    vehicleSubtotal,
    destinationFee: DESTINATION_FEE,
    orderFee: ORDER_FEE,
    incentives: FEDERAL_INCENTIVE,
    purchasePrice,
    dueToday: ORDER_FEE,
    financeMonthly: Math.round(financeMonthly),
    leaseMonthly: Math.round(leaseMonthly),
    savingsPerMonth: GAS_SAVINGS_PER_MONTH,
  };
}
