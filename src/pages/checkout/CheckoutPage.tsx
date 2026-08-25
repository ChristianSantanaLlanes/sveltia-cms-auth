import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactElement,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CarRender from '@/components/car/CarRender';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Select from '@/components/ui/Select';
import useMediaQuery, { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { money, monthly, num } from '@/lib/format';
import { APR, DOWN_PAYMENT_RATE, LEASE_TERM, TERM_MONTHS } from '@/lib/pricing';
import {
  ORDER_FIELD_ORDER,
  cardBrand,
  digitsOnly,
  emptyOrderForm,
  formatCardNumber,
  formatExpiry,
  formatPhone,
  formatZip,
  validateField,
  validateOrderForm,
  type CardBrand,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormValues,
} from '@/lib/validation';
import { useOrder } from '@/store/OrderContext';
import type { PaymentMode } from '@/types';
import { newOrderId, writePlacedOrder, type PlacedOrder } from './ConfirmationPage';
import OrderSummary from './OrderSummary';
import './CheckoutPage.css';

/** How long the order "posts" for before the confirmation route takes over. */
const SUBMIT_MS = 900;

const MODES: { id: PaymentMode; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'finance', label: 'Finance' },
  { id: 'lease', label: 'Lease' },
];

const CARD_MARKS: { id: CardBrand; label: string }[] = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'amex', label: 'American Express' },
  { id: 'discover', label: 'Discover' },
];

const US_STATES: { value: string; label: string }[] = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' }, { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' }, { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' }, { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' }, { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' }, { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' }, { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' }, { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' }, { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

/** Stable DOM id per field — the submit handler focuses by id. */
const fid = (field: OrderFormField): string => `co-${field}`;

export default function CheckoutPage(): ReactElement {
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { config, price, resolved, paymentMode, setPaymentMode, zip, setZip } = useOrder();
  const { model, trim, paint, wheel } = resolved;

  const [values, setValues] = useState<OrderFormValues>(() => ({ ...emptyOrderForm(), zip }));
  const [errors, setErrors] = useState<OrderFormErrors>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  /* ── Field plumbing ────────────────────────────────────────────────────── */

  const clearError = (field: OrderFormField, next: OrderFormValues) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const message = validateField(field, next);
      if (message === prev[field]) return prev;
      const copy = { ...prev };
      if (message) copy[field] = message;
      else delete copy[field];
      return copy;
    });
  };

  /** Writes the value and, if the field is already flagged, re-checks it live. */
  const setValue = (field: OrderFormField, value: string | boolean) => {
    const next = { ...values, [field]: value } as OrderFormValues;
    setValues(next);
    clearError(field, next);
    return next;
  };

  const handleBlur = (field: OrderFormField) => () => {
    const message = validateField(field, values);
    setErrors((prev) => {
      const copy = { ...prev };
      if (message) copy[field] = message;
      else delete copy[field];
      return copy;
    });
  };

  const text =
    (field: OrderFormField) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setValue(field, event.target.value);
    };

  const handleZip = (event: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatZip(event.target.value);
    setValue('zip', formatted);
    // Only a complete ZIP is worth pushing back into the order — a partial one
    // would make the delivery estimate elsewhere read as broken.
    const digits = digitsOnly(formatted);
    if (digits.length >= 5) setZip(digits.slice(0, 5));
  };

  const focusField = (field: OrderFormField) => {
    // Wait a frame so the newly-rendered error messages have shifted layout
    // before we measure whether the field is actually on screen.
    requestAnimationFrame(() => {
      const el = document.getElementById(fid(field));
      if (!el) return;
      el.focus({ preventScroll: true });
      const rect = el.getBoundingClientRect();
      const topLimit = 56 /* header */ + 24;
      const offscreen = rect.top < topLimit || rect.bottom > window.innerHeight - 24;
      if (offscreen) {
        el.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      }
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const found = validateOrderForm(values);
    setErrors(found);
    setSubmitAttempted(true);

    const firstInvalid = ORDER_FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    const order: PlacedOrder = {
      id: newOrderId(),
      placedAt: new Date().toISOString(),
      config,
      paymentMode,
      customer: {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: formatPhone(values.phone),
        address1: values.address1.trim(),
        address2: values.address2.trim(),
        city: values.city.trim(),
        state: values.state,
        zip: values.zip.trim(),
      },
      cardLast4: digitsOnly(values.cardNumber).slice(-4),
    };

    setSubmitting(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      writePlacedOrder(order);
      navigate(`/order/${order.id}`, { state: { order } });
    }, SUBMIT_MS);
  };

  /* ── Derived copy ──────────────────────────────────────────────────────── */

  const errorCount = ORDER_FIELD_ORDER.filter((field) => errors[field]).length;
  const announcement = submitting
    ? 'Placing your order.'
    : !submitAttempted
    ? ''
    : errorCount > 0
      ? `${errorCount} ${errorCount === 1 ? 'field needs' : 'fields need'} your attention before this order can be placed.`
      : 'All details are complete. Your order is ready to place.';

  const downPayment = Math.round(price.purchasePrice * DOWN_PAYMENT_RATE);
  const modeIndex = Math.max(0, MODES.findIndex((m) => m.id === paymentMode));

  const headline =
    paymentMode === 'cash'
      ? money(price.purchasePrice)
      : paymentMode === 'finance'
        ? monthly(price.financeMonthly)
        : monthly(price.leaseMonthly);

  const headlineCaption =
    paymentMode === 'cash' ? 'Total purchase price' : 'Est. monthly payment';

  const modeRows: { label: string; value: string }[] =
    paymentMode === 'finance'
      ? [
          { label: 'Down payment', value: money(downPayment) },
          { label: 'Term', value: `${TERM_MONTHS} months at ${(APR * 100).toFixed(2)}% APR` },
          { label: 'Amount financed', value: money(price.purchasePrice - downPayment) },
        ]
      : paymentMode === 'lease'
        ? [
            { label: 'Due at signing', value: money(price.dueToday) },
            { label: 'Term', value: `${LEASE_TERM} months, ${num(10000)} mi/yr` },
            { label: 'Residual', value: 'Purchase option at lease end' },
          ]
        : [
            { label: 'Due today', value: money(price.dueToday) },
            { label: 'Balance at delivery', value: money(price.purchasePrice - price.dueToday) },
            { label: 'Method', value: 'Bank transfer or certified funds' },
          ];

  const modeDisclaimer =
    paymentMode === 'cash'
      ? `Shown after ${money(price.incentives)} est. federal incentive. Excludes taxes, title and registration.`
      : paymentMode === 'finance'
        ? `Estimate only, after ${money(price.incentives)} est. federal incentive. Excludes taxes and fees. Subject to credit approval.`
        : `Estimate only. Excess mileage and wear charges may apply. Excludes taxes and fees. Subject to credit approval.`;

  const brand = cardBrand(values.cardNumber);

  return (
    <div className="checkout">
      <div className="checkout__inner">
        <header className="checkout__head">
          <p className="checkout__eyebrow">Checkout</p>
          <h1 className="checkout__title">Order your {model.name}</h1>
          <p className="checkout__sub">
            Your configuration is held while you complete this order. Nothing but the{' '}
            {money(price.dueToday)} order fee is charged today.
          </p>
        </header>

        <div className="checkout__grid">
          <div className="checkout__rail">
            <OrderSummary
              config={config}
              price={price}
              paymentMode={paymentMode}
              variant={isDesktop ? 'rail' : 'strip'}
            />
          </div>

          <form className="checkout__form" onSubmit={handleSubmit} noValidate>
            {/* ── 1. Your Vehicle ───────────────────────────────────────── */}
            <section className="co-sec" aria-labelledby="co-sec-vehicle">
              <h2 className="co-secTitle" id="co-sec-vehicle">
                Your Vehicle
              </h2>

              <div className="co-vehicle">
                <div className="co-vehicle__plate">
                  <CarRender
                    body={model.body}
                    paint={paint}
                    wheel={wheel}
                    view="side"
                    ground
                    className="co-vehicle__car"
                    label={`${model.name} ${trim.name} in ${paint.name}`}
                  />
                </div>

                <div className="co-vehicle__info">
                  <p className="co-vehicle__model">{model.name}</p>
                  <p className="co-vehicle__trim">{trim.name}</p>

                  <ul className="co-vehicle__lines">
                    {price.lines.map((line) => (
                      <li className="co-vehicle__line" key={line.id}>
                        <span>{line.label}</span>
                        <span className="co-num">{money(line.amount)}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="co-vehicle__total">
                    <span>Total</span>
                    <span className="co-num">{money(price.purchasePrice)}</span>
                  </p>

                  <Link className="co-link" to={`/design/${model.id}`}>
                    Edit your design
                  </Link>
                </div>
              </div>
            </section>

            {/* ── 2. Payment Method ─────────────────────────────────────── */}
            <section className="co-sec" aria-labelledby="co-sec-method">
              <h2 className="co-secTitle" id="co-sec-method">
                Payment Method
              </h2>

              <div
                className="co-seg"
                role="radiogroup"
                aria-label="Payment method"
                style={{ '--seg-i': modeIndex } as CSSProperties}
              >
                <span className="co-seg__thumb" aria-hidden="true" />
                {MODES.map((option) => (
                  <label
                    className={`co-seg__opt${option.id === paymentMode ? ' is-on' : ''}`}
                    key={option.id}
                    data-testid={`payment-${option.id}`}
                  >
                    <input
                      className="co-seg__input"
                      type="radio"
                      name="co-payment-mode"
                      value={option.id}
                      checked={option.id === paymentMode}
                      onChange={() => setPaymentMode(option.id)}
                    />
                    <span className="co-seg__label">{option.label}</span>
                  </label>
                ))}
              </div>

              <div className="co-mode">
                <p className="co-mode__figure">
                  <span className="co-mode__value">{headline}</span>
                  <span className="co-mode__caption">{headlineCaption}</span>
                </p>

                <dl className="co-mode__rows">
                  {modeRows.map((row) => (
                    <div className="co-mode__row" key={row.label}>
                      <dt>{row.label}</dt>
                      <dd className="co-num">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <p className="co-fine">{modeDisclaimer}</p>
            </section>

            {/* ── 3. Contact ────────────────────────────────────────────── */}
            <section className="co-sec" aria-labelledby="co-sec-contact">
              <h2 className="co-secTitle" id="co-sec-contact">
                Contact
              </h2>

              <div className="co-grid co-grid--2">
                <Field
                  id={fid('firstName')}
                  label="First name"
                  name="firstName"
                  autoComplete="given-name"
                  value={values.firstName}
                  error={errors.firstName}
                  onChange={text('firstName')}
                  onBlur={handleBlur('firstName')}
                />
                <Field
                  id={fid('lastName')}
                  label="Last name"
                  name="lastName"
                  autoComplete="family-name"
                  value={values.lastName}
                  error={errors.lastName}
                  onChange={text('lastName')}
                  onBlur={handleBlur('lastName')}
                />
                <Field
                  id={fid('email')}
                  className="co-span2"
                  label="Email address"
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  value={values.email}
                  error={errors.email}
                  hint="Your order confirmation and delivery updates are sent here."
                  onChange={text('email')}
                  onBlur={handleBlur('email')}
                />
                <Field
                  id={fid('phone')}
                  className="co-span2"
                  label="Phone number"
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  value={values.phone}
                  error={errors.phone}
                  onChange={(event) => setValue('phone', formatPhone(event.target.value))}
                  onBlur={handleBlur('phone')}
                />
              </div>
            </section>

            {/* ── 4. Registration ───────────────────────────────────────── */}
            <section className="co-sec" aria-labelledby="co-sec-registration">
              <h2 className="co-secTitle" id="co-sec-registration">
                Registration
              </h2>
              <p className="co-secNote">
                The address the vehicle will be registered to. It determines your taxes, fees and
                delivery location.
              </p>

              <div className="co-grid co-grid--reg">
                <Field
                  id={fid('address1')}
                  className="co-span2"
                  label="Street address"
                  name="address1"
                  autoComplete="address-line1"
                  value={values.address1}
                  error={errors.address1}
                  onChange={text('address1')}
                  onBlur={handleBlur('address1')}
                />
                <Field
                  id={fid('address2')}
                  className="co-span2"
                  label="Apartment, suite (optional)"
                  name="address2"
                  autoComplete="address-line2"
                  value={values.address2}
                  onChange={text('address2')}
                />
                <Field
                  id={fid('city')}
                  className="co-city"
                  label="City"
                  name="city"
                  autoComplete="address-level2"
                  value={values.city}
                  error={errors.city}
                  onChange={text('city')}
                  onBlur={handleBlur('city')}
                />
                <Select
                  id={fid('state')}
                  className="co-state"
                  label="State"
                  name="state"
                  autoComplete="address-level1"
                  value={values.state}
                  error={errors.state}
                  onChange={(event) => setValue('state', event.target.value)}
                  onBlur={handleBlur('state')}
                >
                  <option value="">Select</option>
                  {US_STATES.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </Select>
                <Field
                  id={fid('zip')}
                  className="co-zip"
                  label="ZIP code"
                  name="zip"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={10}
                  value={values.zip}
                  error={errors.zip}
                  onChange={handleZip}
                  onBlur={handleBlur('zip')}
                />
              </div>
            </section>

            {/* ── 5. Payment ────────────────────────────────────────────── */}
            <section className="co-sec" aria-labelledby="co-sec-payment">
              <div className="co-secHead">
                <h2 className="co-secTitle" id="co-sec-payment">
                  Payment
                </h2>
                <ul className={`co-cards${brand ? ' has-brand' : ''}`} aria-label="Cards accepted">
                  {CARD_MARKS.map((mark) => (
                    <li
                      className={`co-card co-card--${mark.id}${brand === mark.id ? ' is-on' : ''}`}
                      key={mark.id}
                    >
                      <span className="sr-only">{mark.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="co-grid co-grid--pay">
                <Field
                  id={fid('cardNumber')}
                  className="co-span2"
                  label="Card number"
                  name="cardNumber"
                  autoComplete="cc-number"
                  inputMode="numeric"
                  maxLength={23}
                  value={values.cardNumber}
                  error={errors.cardNumber}
                  onChange={(event) => setValue('cardNumber', formatCardNumber(event.target.value))}
                  onBlur={handleBlur('cardNumber')}
                />
                <Field
                  id={fid('expiry')}
                  label="Expiry (MM/YY)"
                  name="expiry"
                  autoComplete="cc-exp"
                  inputMode="numeric"
                  maxLength={7}
                  value={values.expiry}
                  error={errors.expiry}
                  onChange={(event) => setValue('expiry', formatExpiry(event.target.value))}
                  onBlur={handleBlur('expiry')}
                />
                <Field
                  id={fid('cvc')}
                  label="Security code"
                  name="cvc"
                  autoComplete="cc-csc"
                  inputMode="numeric"
                  maxLength={4}
                  value={values.cvc}
                  error={errors.cvc}
                  hint="3 digits on the back, 4 on the front for Amex."
                  onChange={(event) => setValue('cvc', digitsOnly(event.target.value).slice(0, 4))}
                  onBlur={handleBlur('cvc')}
                />
                <Field
                  id={fid('cardName')}
                  className="co-span2"
                  label="Name on card"
                  name="cardName"
                  autoComplete="cc-name"
                  value={values.cardName}
                  error={errors.cardName}
                  onChange={text('cardName')}
                  onBlur={handleBlur('cardName')}
                />
              </div>
            </section>

            {/* ── 6. Order agreement ────────────────────────────────────── */}
            <section className="co-sec co-sec--agree" aria-labelledby="co-sec-agreement">
              <h2 className="co-secTitle" id="co-sec-agreement">
                Order Agreement
              </h2>

              <div className={`co-check${errors.agree ? ' is-error' : ''}`}>
                <input
                  className="co-check__input"
                  id={fid('agree')}
                  type="checkbox"
                  checked={values.agree}
                  aria-invalid={errors.agree ? true : undefined}
                  aria-describedby={errors.agree ? 'co-agree-error' : undefined}
                  onChange={(event) => setValue('agree', event.target.checked)}
                />
                <label className="co-check__label" htmlFor={fid('agree')}>
                  I have read and agree to the Vela Motors Order Agreement, the Privacy Notice and
                  the Terms of Use, and I authorise Vela Motors to charge the{' '}
                  {money(price.dueToday)} order fee to the card above.
                </label>
              </div>

              {errors.agree ? (
                <p className="co-check__error" id="co-agree-error" role="alert">
                  {errors.agree}
                </p>
              ) : null}

              <p className="co-fine">
                The {money(price.dueToday)} Order Fee is non-refundable and is applied to the
                purchase price of your vehicle. Placing this order is not a contract of sale — your
                Vela Advisor confirms final pricing, taxes and registration fees before delivery.
              </p>

              <p
                className="co-live"
                data-tone={errorCount > 0 && !submitting ? 'error' : 'ok'}
                role="status"
                aria-live="polite"
              >
                {announcement}
              </p>

              <Button
                type="submit"
                data-testid="place-order"
                size="lg"
                fullWidth
                loading={submitting}
              >
                {submitting
                  ? 'Placing your order'
                  : `Place Order — ${money(price.dueToday)} due today`}
              </Button>

              <p className="co-fine co-fine--center">{model.leadTime}</p>
            </section>
          </form>
        </div>
      </div>
    </div>
  );
}
