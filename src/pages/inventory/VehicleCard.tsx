import { useMemo, type ReactElement } from 'react';
import Button from '@/components/ui/Button';
import CarRender from '@/components/car/CarRender';
import { Skeleton } from '@/components/ui/Skeleton';
import { vehicleTitle } from '@/data/inventory';
import { miles, money, num } from '@/lib/format';
import { APR, DOWN_PAYMENT_RATE, TERM_MONTHS, effectiveRange, monthlyPayment, priceConfig, resolveConfig } from '@/lib/pricing';
import { useOrder } from '@/store/OrderContext';
import type { InventoryVehicle } from '@/types';
import './VehicleCard.css';

export interface VehicleCardProps {
  vehicle: InventoryVehicle;
}

const CONDITION_LABEL: Record<string, string> = { demo: 'Demo', used: 'Used' };

/** Below this the discount is rounding noise and the struck MSRP is just clutter. */
const MSRP_THRESHOLD = 500;

/**
 * One tab stop per card: the "View Details" button carries a stretched hit area
 * over the whole card, so a pointer can click anywhere while a keyboard user
 * lands on the card exactly once and hears the full vehicle in the button name.
 */
export function VehicleCard({ vehicle }: VehicleCardProps): ReactElement {
  const { setConfig, setInventoryId } = useOrder();

  const { model, trim, paint, wheel } = useMemo(() => resolveConfig(vehicle.config), [vehicle.config]);

  const finance = useMemo(() => {
    // Fees and the incentive come from the shared pricing engine; the vehicle's
    // asking price replaces the as-configured subtotal.
    const breakdown = priceConfig(vehicle.config);
    const purchase = vehicle.price + breakdown.destinationFee + breakdown.orderFee - breakdown.incentives;
    const financed = Math.max(0, purchase) * (1 - DOWN_PAYMENT_RATE);
    return Math.round(monthlyPayment(financed, APR, TERM_MONTHS));
  }, [vehicle.config, vehicle.price]);

  const range = useMemo(() => effectiveRange(vehicle.config), [vehicle.config]);
  const title = vehicleTitle(vehicle);
  const badge = CONDITION_LABEL[vehicle.condition];
  const showMsrp = vehicle.savings >= MSRP_THRESHOLD;

  const cta = [
    'View Details',
    '—',
    title,
    trim.name,
    'in',
    paint.name,
    `for ${money(vehicle.price)},`,
    `${vehicle.city}, ${vehicle.state}`,
  ].join(' ');

  const select = () => {
    setInventoryId(vehicle.id);
    setConfig(vehicle.config);
  };

  return (
    <article className="vcard" data-testid="vehicle-card">
      <div className="vcard__plate">
        {badge ? (
          <p className="vcard__badges">
            <span className="vcard__badge">{badge}</span>
            <span className="vcard__badge vcard__badge--odo">
              {num(vehicle.odometer)} mi<span className="sr-only"> on the odometer</span>
            </span>
          </p>
        ) : null}
        <div className="vcard__car">
          <CarRender
            body={model.body}
            paint={paint}
            wheel={wheel}
            view="side"
            label={`${title} in ${paint.name} with ${wheel.name}`}
          />
        </div>
      </div>

      <div className="vcard__body">
        <div className="vcard__top">
          <header className="vcard__head">
            <h3 className="vcard__title">{title}</h3>
            <p className="vcard__trim">{trim.name}</p>
          </header>

          <div className="vcard__price">
            <p className="vcard__amount">
              {money(vehicle.price)}
              {showMsrp ? (
                <span className="vcard__msrp">
                  <span className="sr-only">Original price </span>
                  {money(vehicle.msrp)}
                </span>
              ) : null}
            </p>
            <p className="vcard__monthly">Est. {money(finance)}/mo after incentives</p>
          </div>

          <dl className="vcard__specs">
            <div className="vcard__spec">
              <dt>Range</dt>
              <dd>{miles(range)}</dd>
            </div>
            <div className="vcard__spec">
              <dt>0–60 mph</dt>
              <dd>{trim.accel.toFixed(trim.accel < 3 ? 2 : 1)} s</dd>
            </div>
            <div className="vcard__spec">
              <dt>Drive</dt>
              <dd>{trim.drive}</dd>
            </div>
          </dl>
        </div>

        <div className="vcard__foot">
          <p className="vcard__meta">
            <span>
              {vehicle.city}, {vehicle.state}
            </span>
            <span>{num(vehicle.distance)} mi away</span>
          </p>
          <p className="vcard__meta vcard__meta--delivery">Est. delivery {vehicle.deliveryWindow}</p>

          <Button
            to={`/design/${vehicle.config.modelId}`}
            variant="primary"
            fullWidth
            className="vcard__cta"
            aria-label={cta}
            onClick={select}
          >
            View Details
          </Button>
        </div>
      </div>
    </article>
  );
}

/** Same box model as the real card, so the grid never reflows when data lands. */
export function VehicleCardSkeleton(): ReactElement {
  return (
    <article className="vcard vcard--skeleton" aria-hidden="true">
      <div className="vcard__plate">
        <div className="vcard__car">
          <Skeleton w="100%" h="100%" radius="var(--r-md)" />
        </div>
      </div>

      <div className="vcard__body">
        <div className="vcard__top">
          <header className="vcard__head">
            <p className="vcard__title">
              <Skeleton w={148} h={24} />
            </p>
            <p className="vcard__trim">
              <Skeleton w={186} h={19} />
            </p>
          </header>

          <div className="vcard__price">
            <p className="vcard__amount">
              <Skeleton w={128} h={31} />
            </p>
            <p className="vcard__monthly">
              <Skeleton w={168} h={19} />
            </p>
          </div>

          <div className="vcard__specs">
            <div className="vcard__spec">
              <Skeleton w={46} h={13} />
              <Skeleton w={58} h={18} />
            </div>
            <div className="vcard__spec">
              <Skeleton w={58} h={13} />
              <Skeleton w={44} h={18} />
            </div>
            <div className="vcard__spec">
              <Skeleton w={40} h={13} />
              <Skeleton w={48} h={18} />
            </div>
          </div>
        </div>

        <div className="vcard__foot">
          <p className="vcard__meta">
            <Skeleton w={196} h={20} />
          </p>
          <p className="vcard__meta vcard__meta--delivery">
            <Skeleton w={148} h={17} />
          </p>

          <Skeleton w="100%" h={40} radius="var(--r-pill)" className="vcard__cta-skeleton" />
        </div>
      </div>
    </article>
  );
}

export default VehicleCard;
