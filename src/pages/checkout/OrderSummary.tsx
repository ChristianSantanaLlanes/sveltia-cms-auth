import { useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import CarRender from '@/components/car/CarRender';
import { money, monthly, num, signedMoney } from '@/lib/format';
import {
  APR,
  DOWN_PAYMENT_RATE,
  LEASE_TERM,
  TERM_MONTHS,
  resolveConfig,
} from '@/lib/pricing';
import type { PaymentMode, PriceBreakdown, VehicleConfig } from '@/types';
import './OrderSummary.css';

export interface OrderSummaryProps {
  config: VehicleConfig;
  price: PriceBreakdown;
  paymentMode: PaymentMode;
  /**
   * `rail` sticks to the right column at ≥1024px, `strip` is the collapsible
   * bar used on narrow viewports, `static` is always open and never sticky.
   */
  variant?: 'rail' | 'strip' | 'static';
  heading?: string;
  className?: string;
}

/** The one payment line shown under the total, for whichever mode is active. */
function paymentLine(price: PriceBreakdown, mode: PaymentMode) {
  const down = Math.round(price.purchasePrice * DOWN_PAYMENT_RATE);
  if (mode === 'finance') {
    return {
      label: 'Est. finance',
      value: monthly(price.financeMonthly),
      detail: `${TERM_MONTHS} mo · ${(APR * 100).toFixed(2)}% APR · ${money(down)} down`,
    };
  }
  if (mode === 'lease') {
    return {
      label: 'Est. lease',
      value: monthly(price.leaseMonthly),
      detail: `${LEASE_TERM} mo · ${num(10000)} mi/yr · ${money(price.dueToday)} due at signing`,
    };
  }
  return {
    label: 'Cash purchase',
    value: money(price.purchasePrice),
    detail: `Balance due at delivery · ${money(price.dueToday)} order fee today`,
  };
}

export default function OrderSummary({
  config,
  price,
  paymentMode,
  variant = 'rail',
  heading = 'Order summary',
  className,
}: OrderSummaryProps): ReactElement {
  const rid = `os${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const panelId = `${rid}-panel`;
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const collapsible = variant === 'strip';
  const expanded = !collapsible || open;

  /* The panel stays mounted so it can animate open; while collapsed it has to
     leave the tab order and the accessibility tree. */
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (el) el.inert = collapsible && !open;
  }, [collapsible, open]);

  const { model, trim, paint, wheel } = resolveConfig(config);
  const pay = paymentLine(price, paymentMode);

  const classes = ['osum', `osum--${variant}`, expanded ? 'is-open' : null, className]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} aria-label={heading}>
      {collapsible ? (
        <button
          type="button"
          className="osum__strip"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="osum__stripText">
            <span className="osum__stripLabel">{heading}</span>
            <span className="osum__stripHint">{open ? 'Hide details' : 'Show details'}</span>
          </span>
          <span className="osum__stripTotal">{money(price.purchasePrice)}</span>
          <span className="osum__chev" aria-hidden="true" />
        </button>
      ) : (
        <h2 className="osum__heading">{heading}</h2>
      )}

      <div className="osum__panel" id={panelId} ref={panelRef}>
        <div className="osum__clip">
          <div className="osum__vehicle">
            <div className="osum__plate">
              <CarRender
                body={model.body}
                paint={paint}
                wheel={wheel}
                view="side"
                ground
                className="osum__car"
                label={`${model.name} ${trim.name} in ${paint.name}`}
              />
            </div>
            <div className="osum__ident">
              <p className="osum__model">{model.name}</p>
              <p className="osum__trim">{trim.name}</p>
            </div>
          </div>

          <ul className="osum__lines">
            {price.lines.map((line) => (
              <li className="osum__line" key={line.id}>
                <span className="osum__lineLabel">{line.label}</span>
                <span className="osum__lineAmount">{money(line.amount)}</span>
              </li>
            ))}
          </ul>

          <ul className="osum__lines osum__lines--fees">
            <li className="osum__line osum__line--sub">
              <span className="osum__lineLabel">Vehicle subtotal</span>
              <span className="osum__lineAmount">{money(price.vehicleSubtotal)}</span>
            </li>
            <li className="osum__line">
              <span className="osum__lineLabel">Destination &amp; Doc Fee</span>
              <span className="osum__lineAmount">{money(price.destinationFee)}</span>
            </li>
            <li className="osum__line">
              <span className="osum__lineLabel">Order Fee</span>
              <span className="osum__lineAmount">{money(price.orderFee)}</span>
            </li>
            <li className="osum__line osum__line--credit">
              <span className="osum__lineLabel">Est. Federal Incentive</span>
              <span className="osum__lineAmount">{signedMoney(-price.incentives)}</span>
            </li>
          </ul>

          <p className="osum__total">
            <span className="osum__totalLabel">Total</span>
            <span className="osum__totalValue" data-testid="price-total">
              {money(price.purchasePrice)}
            </span>
          </p>

          <div className="osum__pay">
            <p className="osum__payRow">
              <span className="osum__payLabel">{pay.label}</span>
              <span className="osum__payValue">{pay.value}</span>
            </p>
            <p className="osum__payDetail">{pay.detail}</p>
          </div>

          <p className="osum__lead">{model.leadTime}</p>
        </div>
      </div>
    </section>
  );
}

export { OrderSummary };
