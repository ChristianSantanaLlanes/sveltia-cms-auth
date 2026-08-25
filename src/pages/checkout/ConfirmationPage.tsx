import { useMemo, type ReactElement } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import CarRender from '@/components/car/CarRender';
import Button from '@/components/ui/Button';
import { priceConfig, resolveConfig } from '@/lib/pricing';
import type { PaymentMode, VehicleConfig } from '@/types';
import OrderSummary from './OrderSummary';
import './ConfirmationPage.css';

/* ── The placed-order record ─────────────────────────────────────────────
   Written by CheckoutPage on submit, carried through `location.state` and
   mirrored into sessionStorage so a refresh on /order/:id still resolves.
   Only the configuration is stored — every price is recomputed from it, so a
   stale receipt can never show a number the pricing model would not.        */

export interface PlacedOrderCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
}

export interface PlacedOrder {
  id: string;
  /** ISO timestamp of when the order was placed. */
  placedAt: string;
  config: VehicleConfig;
  paymentMode: PaymentMode;
  customer: PlacedOrderCustomer;
  /** Last four digits of the card used — never the full number. */
  cardLast4: string;
}

const RECEIPT_PREFIX = 'vela.receipt.';

export const orderStorageKey = (id: string): string => `${RECEIPT_PREFIX}${id}`;

export function writePlacedOrder(order: PlacedOrder): void {
  try {
    window.sessionStorage.setItem(orderStorageKey(order.id), JSON.stringify(order));
  } catch {
    /* Storage unavailable — the order still arrives via location.state. */
  }
}

export function readPlacedOrder(id: string): PlacedOrder | null {
  try {
    const raw = window.sessionStorage.getItem(orderStorageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlacedOrder;
    return parsed && parsed.config && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

/* Crockford-style alphabet: no 0/O or 1/I to misread over the phone. */
const ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < length; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export function newOrderId(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]);
  return `VM-${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

/** The order rendered at `/order/demo` — a real, fully-specified vehicle. */
export function demoOrder(): PlacedOrder {
  return {
    id: 'VM-4KTP-9QD3',
    placedAt: '2026-08-19T16:24:00.000Z',
    config: {
      modelId: 'vela-3',
      trimId: 'lr-awd',
      paintId: 'deep-blue',
      wheelId: 'sport-19',
      interiorId: 'cream-int',
      seatingId: 'five',
      addOnIds: ['enhanced-autopilot', 'accessory-bundle'],
    },
    paymentMode: 'finance',
    customer: {
      firstName: 'Avery',
      lastName: 'Whitfield',
      email: 'avery.whitfield@example.com',
      phone: '(415) 555-0139',
      address1: '1180 Alder Street',
      address2: 'Apt 4B',
      city: 'San Mateo',
      state: 'CA',
      zip: '94402',
    },
    cardLast4: '4242',
  };
}

/** `Est. delivery: Oct — Nov 2026` → `Oct — Nov 2026`. */
export function deliveryWindow(leadTime: string): string {
  return leadTime.replace(/^\s*est\.?\s*delivery:\s*/i, '').trim();
}

const PLACED_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const STEPS = [
  {
    id: 'confirm',
    title: 'Confirm your details',
    body: 'We verify your registration address and run a quick credit check. Nothing else is due until your Vela is built.',
  },
  {
    id: 'arrange',
    title: 'Arrange delivery',
    body: 'Once production is scheduled, choose a delivery centre or have the car brought to your address.',
  },
  {
    id: 'take',
    title: 'Take delivery',
    body: 'Final paperwork is signed on the day. Your Vela leaves with you, charged and registered.',
  },
];

export default function ConfirmationPage(): ReactElement {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();

  const stateOrder = (location.state as { order?: PlacedOrder } | null)?.order ?? null;

  const order = useMemo<PlacedOrder | null>(() => {
    if (stateOrder && (!orderId || orderId === 'demo' || stateOrder.id === orderId)) return stateOrder;
    if (orderId) {
      const stored = readPlacedOrder(orderId);
      if (stored) return stored;
      if (orderId === 'demo') return demoOrder();
    }
    return null;
  }, [stateOrder, orderId]);

  if (!order) {
    return (
      <div className="conf conf--missing">
        <div className="conf__inner">
          <h1 className="conf__title">We can’t find that order.</h1>
          <p className="conf__lede">
            Order {orderId ? <strong>{orderId}</strong> : 'records'} isn’t available on this device.
            Orders are held against the browser they were placed in — check the confirmation email,
            or start a new design.
          </p>
          <nav className="conf__links" aria-label="Continue">
            <Button to="/design/vela-3" variant="primary" size="lg">
              Design your Vela
            </Button>
            <Button to="/inventory" variant="secondary" size="lg">
              View existing inventory
            </Button>
          </nav>
        </div>
      </div>
    );
  }

  const { model, trim, paint, wheel, interior, addOns } = resolveConfig(order.config);
  const price = priceConfig(order.config);
  const deliveryEta = deliveryWindow(model.leadTime);
  const placed = new Date(order.placedAt);
  const placedLabel = Number.isNaN(placed.getTime()) ? '' : PLACED_FORMAT.format(placed);

  return (
    <div className="conf">
      <div className="conf__inner">
        <header className="conf__head">
          <p className="conf__eyebrow">Order confirmed</p>
          <h1 className="conf__title">Your Vela is reserved.</h1>
          <p className="conf__lede">
            Thank you, {order.customer.firstName}. A copy of this order is on its way to{' '}
            <span className="conf__nowrap">{order.customer.email}</span>. Your Vela Advisor will be
            in touch before delivery is scheduled.
          </p>

          <dl className="conf__meta">
            <div className="conf__metaItem">
              <dt>Order number</dt>
              <dd className="conf__orderNo">{order.id}</dd>
            </div>
            {placedLabel ? (
              <div className="conf__metaItem">
                <dt>Placed</dt>
                <dd>{placedLabel}</dd>
              </div>
            ) : null}
            <div className="conf__metaItem">
              <dt>Delivery window</dt>
              <dd>{deliveryEta}</dd>
            </div>
          </dl>
        </header>

        <div className="conf__stage">
          <CarRender
            body={model.body}
            paint={paint}
            wheel={wheel}
            view="front-3q"
            ground
            className="conf__car"
            label={`${model.name} ${trim.name} in ${paint.name} with ${wheel.name}`}
          />
        </div>

        <div className="conf__grid">
          <section className="conf__next" aria-labelledby="conf-next-heading">
            <h2 className="conf__h2" id="conf-next-heading">
              What happens next
            </h2>

            <ol className="conf__steps">
              {STEPS.map((step, index) => {
                const current = index === 0;
                return (
                  <li
                    className={`conf__step${current ? ' is-current' : ''}`}
                    key={step.id}
                    aria-current={current ? 'step' : undefined}
                  >
                    <span className="conf__stepMark" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div className="conf__stepBody">
                      <p className="conf__stepTitle">
                        {step.title}
                        {current ? <span className="conf__stepNow">In progress</span> : null}
                      </p>
                      <p className="conf__stepText">{step.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="conf__delivery">
              <p className="conf__deliveryLabel">Estimated delivery</p>
              <p className="conf__deliveryValue">{deliveryEta}</p>
              <p className="conf__deliveryTo">
                to {order.customer.city}, {order.customer.state} {order.customer.zip}
              </p>
            </div>

            <dl className="conf__spec">
              <div className="conf__specRow">
                <dt>Vehicle</dt>
                <dd>
                  {model.name} {trim.name}
                </dd>
              </div>
              <div className="conf__specRow">
                <dt>Paint &amp; wheels</dt>
                <dd>
                  {paint.name} · {wheel.name}
                </dd>
              </div>
              <div className="conf__specRow">
                <dt>Interior</dt>
                <dd>{interior.name}</dd>
              </div>
              {addOns.length ? (
                <div className="conf__specRow">
                  <dt>Included packages</dt>
                  <dd>{addOns.map((a) => a.name).join(' · ')}</dd>
                </div>
              ) : null}
              <div className="conf__specRow">
                <dt>Payment</dt>
                <dd>
                  {order.paymentMode === 'cash'
                    ? 'Cash purchase'
                    : order.paymentMode === 'finance'
                      ? 'Financing'
                      : 'Lease'}{' '}
                  · card ending {order.cardLast4}
                </dd>
              </div>
            </dl>
          </section>

          <OrderSummary
            config={order.config}
            price={price}
            paymentMode={order.paymentMode}
            variant="static"
            heading="What you ordered"
            className="conf__summary"
          />
        </div>

        <nav className="conf__links" aria-label="Keep browsing">
          <Link className="conf__link" to={`/design/${model.id}`}>
            Design another Vela
          </Link>
          <Link className="conf__link" to="/inventory">
            Browse existing inventory
          </Link>
        </nav>
      </div>
    </div>
  );
}
