import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import Button from '@/components/ui/Button';
import { money, signedMoney } from '@/lib/format';
import { APR, DOWN_PAYMENT_RATE, LEASE_TERM, TERM_MONTHS } from '@/lib/pricing';
import { useOrder } from '@/store/OrderContext';
import type { PaymentMode } from '@/types';
import './PriceSummary.css';

export interface PriceSummaryProps {
  /** `pinned` docks to the bottom of the option column; `bar` is the mobile bar. */
  variant: 'pinned' | 'bar';
}

const MODES: { id: PaymentMode; label: string; heading: string }[] = [
  { id: 'cash', label: 'Cash', heading: 'Purchase Price' },
  { id: 'finance', label: 'Finance', heading: 'Est. Financing' },
  { id: 'lease', label: 'Lease', heading: 'Est. Lease' },
];

export default function PriceSummary({ variant }: PriceSummaryProps): ReactElement {
  const { price, paymentMode, setPaymentMode, resolved } = useOrder();
  const rid = `ps${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [barOpen, setBarOpen] = useState(false);
  const expandRef = useRef<HTMLDivElement>(null);

  /* The mobile bar keeps its expanded content mounted so it can animate, so it
     has to be taken out of the tab order and the a11y tree while collapsed. */
  useLayoutEffect(() => {
    const el = expandRef.current;
    if (!el) return;
    el.inert = variant === 'bar' && !barOpen;
  }, [variant, barOpen]);

  const modeIndex = Math.max(0, MODES.findIndex((m) => m.id === paymentMode));
  const mode = MODES[modeIndex];
  const headlineValue =
    paymentMode === 'cash'
      ? price.purchasePrice
      : paymentMode === 'finance'
        ? price.financeMonthly
        : price.leaseMonthly;
  const suffix = paymentMode === 'cash' ? '' : '/mo';

  const downPayment = Math.round(price.purchasePrice * DOWN_PAYMENT_RATE);
  const disclaimer =
    paymentMode === 'cash'
      ? `Price shown after ${money(price.incentives)} est. federal incentive. Excludes taxes, title and registration.`
      : paymentMode === 'finance'
        ? `Est. ${TERM_MONTHS} mo at ${(APR * 100).toFixed(2)}% APR with ${money(downPayment)} down, after est. incentives. Excludes taxes and fees. Subject to credit approval.`
        : `Est. ${LEASE_TERM} mo, 10,000 mi/yr, ${money(price.dueToday)} due at signing. Excludes taxes and fees. Subject to credit approval.`;

  const detailsId = `${rid}-details`;
  const expandId = `${rid}-expand`;

  const segmented = (
    <div
      className="ps__seg"
      role="radiogroup"
      aria-label="Payment method"
      style={{ '--seg-i': modeIndex } as CSSProperties}
    >
      <span className="ps__segThumb" aria-hidden="true" />
      {MODES.map((option) => (
        <label
          key={option.id}
          className={`ps__segOpt${option.id === paymentMode ? ' is-on' : ''}`}
          data-testid={`payment-${option.id}`}
        >
          <input
            className="ps__segInput"
            type="radio"
            name={`${rid}-mode`}
            value={option.id}
            checked={option.id === paymentMode}
            onChange={() => setPaymentMode(option.id)}
          />
          <span className="ps__segLabel">{option.label}</span>
        </label>
      ))}
    </div>
  );

  const details = (
    <div className="ps__disclosure">
      <button
        type="button"
        className="ps__toggle"
        aria-expanded={detailsOpen}
        aria-controls={detailsId}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        <span>Price details</span>
        <span className={`ps__chev${detailsOpen ? ' is-open' : ''}`} aria-hidden="true" />
      </button>

      <div className={`ps__panel${detailsOpen ? ' is-open' : ''}`} id={detailsId} aria-hidden={!detailsOpen}>
        <div className="ps__panelClip">
          <ul className="ps__lines">
            {price.lines.map((line) => (
              <li className="ps__line" key={line.id}>
                <span className="ps__lineLabel">{line.label}</span>
                <span className="ps__lineAmount">{money(line.amount)}</span>
              </li>
            ))}
            <li className="ps__line">
              <span className="ps__lineLabel">Destination &amp; Doc Fee</span>
              <span className="ps__lineAmount">{money(price.destinationFee)}</span>
            </li>
            <li className="ps__line">
              <span className="ps__lineLabel">Order Fee</span>
              <span className="ps__lineAmount">{money(price.orderFee)}</span>
            </li>
            <li className="ps__line ps__line--credit">
              <span className="ps__lineLabel">Est. Federal Incentive</span>
              <span className="ps__lineAmount">{signedMoney(-price.incentives)}</span>
            </li>
          </ul>
          <p className="ps__total">
            <span>Total</span>
            <span data-testid="price-total">{money(price.purchasePrice)}</span>
          </p>
        </div>
      </div>
    </div>
  );

  const headline = (
    <span className="ps__headline">
      <AnimatedPrice className="ps__value" value={headlineValue} suffix={suffix} />
    </span>
  );

  const cta = (
    <Button to="/checkout" variant="primary" size="lg" fullWidth data-testid="design-order">
      Order Now
    </Button>
  );

  if (variant === 'bar') {
    return (
      <div className={`ps ps--bar${barOpen ? ' is-open' : ''}`}>
        <div className={`ps__expand${barOpen ? ' is-open' : ''}`} id={expandId} ref={expandRef}>
          <div className="ps__expandClip">
            <div className="ps__expandInner">
              {segmented}
              <p className="ps__disclaimer">{disclaimer}</p>
              {details}
              <p className="ps__lead">{resolved.model.leadTime}</p>
            </div>
          </div>
        </div>

        <div className="ps__barMain">
          <button
            type="button"
            className="ps__handle"
            aria-expanded={barOpen}
            aria-controls={expandId}
            onClick={() => setBarOpen((open) => !open)}
          >
            <span className="ps__handleText">
              <span className="ps__handleLabel">{mode.heading}</span>
              {headline}
            </span>
            <span className={`ps__chev ps__chev--lg${barOpen ? ' is-open' : ''}`} aria-hidden="true" />
          </button>
          {cta}
        </div>
      </div>
    );
  }

  return (
    <div className="ps ps--pinned">
      {segmented}
      <div className="ps__headRow">
        <span className="ps__headLabel">{mode.heading}</span>
        {headline}
        <span className="ps__lead">{resolved.model.leadTime}</span>
      </div>
      <p className="ps__disclaimer">{disclaimer}</p>
      {details}
      <div className="ps__cta">{cta}</div>
    </div>
  );
}
