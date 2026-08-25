/* ── Form validation ─────────────────────────────────────────────────────
   Pure functions only. Every validator returns a human-readable message or
   `null` when the value is acceptable, so a caller can write
   `setError(field, email(value))` without branching.                        */

/** Strip everything that is not a digit. */
export const digitsOnly = (value: string): string => value.replace(/\D+/g, '');

/* ── Single-field validators ─────────────────────────────────────────────── */

export function required(value: string, label = 'This field'): string | null {
  return value.trim() ? null : `${label} is required.`;
}

export function email(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Email address is required.';
  // Deliberately permissive: one @, a dot-bearing domain, no whitespace.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v)) return 'Enter a valid email address.';
  if (v.length > 254) return 'Enter a valid email address.';
  return null;
}

export function phone(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Phone number is required.';
  let d = digitsOnly(v);
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length !== 10) return 'Enter a 10-digit US phone number.';
  // NANP: area code and exchange both start 2–9.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(d)) return 'That number isn’t a valid US phone number.';
  return null;
}

export function zip(value: string): string | null {
  const v = value.trim();
  if (!v) return 'ZIP code is required.';
  if (!/^\d{5}(-\d{4})?$/.test(v)) return 'Enter a 5-digit ZIP code.';
  return null;
}

/** Luhn checksum over an already-stripped digit string. */
export function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = digits.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum > 0 && sum % 10 === 0;
}

export function cardNumber(value: string): string | null {
  const d = digitsOnly(value);
  if (!d) return 'Card number is required.';
  if (d.length < 13 || d.length > 19) return 'Enter a valid card number.';
  if (!luhn(d)) return 'That card number doesn’t look right.';
  return null;
}

export function expiry(value: string, now: Date = new Date()): string | null {
  const v = value.trim();
  if (!v) return 'Expiry date is required.';
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(v);
  if (!match) return 'Use the MM/YY format.';

  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return 'Enter a month between 01 and 12.';

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return 'That card has expired.';
  }
  if (year > currentYear + 20) return 'Check the expiry year.';
  return null;
}

export function cvc(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Security code is required.';
  if (!/^\d{3,4}$/.test(v)) return 'Enter the 3- or 4-digit code.';
  return null;
}

/** A full name: at least two words, each of them a plausible name part. */
export function name(value: string, label = 'Name'): string | null {
  const v = value.trim().replace(/\s+/g, ' ');
  if (!v) return `${label} is required.`;
  const parts = v.split(' ');
  if (parts.length < 2) return `Enter the full name, first and last.`;
  if (!parts.every((part) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.-]*$/.test(part))) {
    return 'Use letters only, as printed on the card.';
  }
  if (parts.some((part) => part.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 2)) {
    return 'Enter the full name, first and last.';
  }
  return null;
}

/* ── Input formatters ────────────────────────────────────────────────────── */

/** `4242424242424242` → `4242 4242 4242 4242`. Caps at 19 digits. */
export function formatCardNumber(value: string): string {
  const d = digitsOnly(value).slice(0, 19);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * `1226` → `12/26`. A single digit above 1 is padded to a month (`5` → `05`).
 * The slash only appears once a third digit exists, so backspacing never traps
 * the caret on a separator the formatter would immediately re-insert.
 */
export function formatExpiry(value: string): string {
  let d = digitsOnly(value).slice(0, 4);
  if (d.length === 1 && d > '1') d = `0${d}`;
  if (d.length >= 3) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** `4155550123` → `(415) 555-0123`, progressively as the user types. */
export function formatPhone(value: string): string {
  let d = digitsOnly(value);
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** `94538-1234` kept, everything else reduced to at most 5 digits. */
export function formatZip(value: string): string {
  const d = digitsOnly(value).slice(0, 9);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover';

/** Best-effort brand from the IIN prefix; `null` until it is unambiguous. */
export function cardBrand(value: string): CardBrand | null {
  const d = digitsOnly(value);
  if (!d) return null;
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(6011|64[4-9]|65)/.test(d)) return 'discover';
  return null;
}

/* ── The order form ──────────────────────────────────────────────────────── */

export interface OrderFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
  cardName: string;
  agree: boolean;
}

export type OrderFormField = keyof OrderFormValues;
export type OrderFormErrors = Partial<Record<OrderFormField, string>>;

/** Document order — drives "focus the first invalid field". */
export const ORDER_FIELD_ORDER: OrderFormField[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'address1',
  'address2',
  'city',
  'state',
  'zip',
  'cardNumber',
  'expiry',
  'cvc',
  'cardName',
  'agree',
];

export const emptyOrderForm = (): OrderFormValues => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  cardNumber: '',
  expiry: '',
  cvc: '',
  cardName: '',
  agree: false,
});

export function validateField(
  field: OrderFormField,
  values: OrderFormValues,
  now: Date = new Date(),
): string | null {
  switch (field) {
    case 'firstName':
      return required(values.firstName, 'First name');
    case 'lastName':
      return required(values.lastName, 'Last name');
    case 'email':
      return email(values.email);
    case 'phone':
      return phone(values.phone);
    case 'address1':
      return required(values.address1, 'Street address');
    case 'address2':
      return null; // Apartment / suite is genuinely optional.
    case 'city':
      return required(values.city, 'City');
    case 'state':
      return required(values.state, 'State');
    case 'zip':
      return zip(values.zip);
    case 'cardNumber':
      return cardNumber(values.cardNumber);
    case 'expiry':
      return expiry(values.expiry, now);
    case 'cvc':
      return cvc(values.cvc);
    case 'cardName':
      return name(values.cardName, 'Name on card');
    case 'agree':
      return values.agree ? null : 'Accept the order agreement to continue.';
    default:
      return null;
  }
}

export function validateOrderForm(values: OrderFormValues, now: Date = new Date()): OrderFormErrors {
  const errors: OrderFormErrors = {};
  for (const field of ORDER_FIELD_ORDER) {
    const message = validateField(field, values, now);
    if (message) errors[field] = message;
  }
  return errors;
}
