/** Validaciones de checkout: reglas puras, sin DOM. */
export const luhn = (num) => {
  const digits = String(num).replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
};

export const cardBrand = (num) => {
  const d = String(num).replace(/\D/g, '');
  if (/^4/.test(d)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'American Express';
  return '';
};

export const validExpiry = (value) => {
  const m = String(value).match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const end = new Date(year, month, 0, 23, 59, 59);
  return end >= now && year <= now.getFullYear() + 15;
};

export const RULES = {
  email: (v) => (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()) ? '' : 'Escribe un email válido, ahí mandamos el certificado de forja.'),
  name: (v) => (v.trim().length >= 2 ? '' : 'Necesitamos tu nombre completo.'),
  phone: (v) => (v.replace(/\D/g, '').length >= 9 ? '' : 'Un teléfono de 9 dígitos para la entrega.'),
  address: (v) => (v.trim().length >= 5 ? '' : 'Calle y número, por favor.'),
  city: (v) => (v.trim().length >= 2 ? '' : 'Indica la ciudad.'),
  zip: (v) => (/^\d{4,6}$/.test(v.trim()) ? '' : 'Código postal de 4 a 6 dígitos.'),
  country: (v) => (v.trim().length >= 2 ? '' : 'Selecciona un país.'),
  card: (v) => (luhn(v) ? '' : 'Ese número de tarjeta no pasa la comprobación.'),
  expiry: (v) => (validExpiry(v) ? '' : 'Caducidad MM/AA, y que no esté vencida.'),
  cvc: (v) => (/^\d{3,4}$/.test(v.trim()) ? '' : 'El CVC son 3 dígitos (4 en Amex).'),
  holder: (v) => (v.trim().length >= 3 ? '' : 'El nombre tal y como aparece en la tarjeta.'),
  age: (v) => (v === true || v === 'on' ? '' : 'Debes confirmar que eres mayor de 18 años.'),
};

export const validateField = (rule, value) => (RULES[rule] ? RULES[rule](value) : '');
