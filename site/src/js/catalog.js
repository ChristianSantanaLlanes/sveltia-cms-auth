/** Catálogo y reglas de precio. Fuente única de verdad para toda la tienda. */

/** @typedef {{id:string,label:string,delta:number,note?:string,swatch?:string,img?:string}} Option */

export const OPTION_GROUPS = [
  {
    id: 'blade',
    label: 'Longitud de hoja',
    help: 'Medida nagasa, del habaki a la punta. Se ajusta al alcance de tu brazo.',
    options: [
      { id: '68', label: '68 cm', delta: -80, note: 'Ágil · 1,68–1,75 m de estatura' },
      { id: '71', label: '71 cm', delta: 0, note: 'Equilibrada · 1,75–1,85 m' },
      { id: '74', label: '74 cm', delta: 120, note: 'Larga · más de 1,85 m' },
    ],
  },
  {
    id: 'edge',
    label: 'Acabado del acero',
    help: 'Cómo se pule la hoja tras el templado. Cambia el brillo, no el filo.',
    options: [
      { id: 'kurogane', label: 'Kurogane', delta: 0, note: 'Pulido satinado, hamon mate', swatch: '#3b3f45' },
      { id: 'mirror', label: 'Espejo', delta: 260, note: 'Pulido hadori a espejo', swatch: '#d8dde3' },
      { id: 'damascus', label: 'Damasco', delta: 480, note: 'Acero plegado 13 veces, veta visible', swatch: '#8a8f96' },
    ],
  },
  {
    id: 'tsuba',
    label: 'Tsuba',
    help: 'La guarda de hierro forjado, hecha a mano por un maestro tsubashi.',
    options: [
      { id: 'aoi', label: 'Aoi', delta: 0, note: 'Hoja de malva, hierro oxidado', swatch: '#4a4a4c' },
      { id: 'namiji', label: 'Namiji', delta: 180, note: 'Olas caladas, hierro y oro nunome', swatch: '#5c5346' },
      { id: 'kiku', label: 'Kiku', delta: 320, note: 'Crisantemo de 16 pétalos, shakudō', swatch: '#2f2a26' },
    ],
  },
  {
    id: 'saya',
    label: 'Saya',
    help: 'Vaina de magnolia lacada a mano con urushi, entre 12 y 30 capas.',
    options: [
      { id: 'kuro', label: 'Negro urushi', delta: 0, note: '18 capas, acabado espejo', swatch: '#0d0d0f' },
      { id: 'ai', label: 'Índigo', delta: 140, note: 'Laca ai teñida en frío', swatch: '#1e3050' },
      { id: 'shu', label: 'Bermellón', delta: 190, note: 'Shu-urushi con polvo de piedra', swatch: '#a8322a' },
    ],
  },
];

export const ENGRAVING_PRICE = 90;

export const PRODUCTS = [
  {
    id: 'mumei',
    name: 'Mumei',
    kanji: '無銘',
    tagline: 'La hoja sin firma.',
    claim: 'Tamahagane plegado 12 veces. Nada sobra.',
    base: 1890,
    steel: 'Tamahagane · 12 pliegues',
    hamon: 'Suguha (recto)',
    weight: '1.080 g',
    lead: '6 semanas',
    stock: 8,
    img: 'prod-mumei',
    accent: '#6f7278',
  },
  {
    id: 'kurogane',
    name: 'Kurogane',
    kanji: '黒鉄',
    tagline: 'Acero negro, filo blanco.',
    claim: 'Pavonado en fuego vivo sobre hamon nie-deki.',
    base: 2340,
    steel: 'Tamahagane · 14 pliegues',
    hamon: 'Notare (ondulado)',
    weight: '1.120 g',
    lead: '7 semanas',
    stock: 5,
    img: 'prod-kurogane',
    accent: '#3b3f45',
  },
  {
    id: 'hanabira',
    name: 'Hanabira',
    kanji: '花びら',
    tagline: 'El temple en flor.',
    claim: 'Hamon chōji: pétalos de cristal dentro del acero.',
    base: 2780,
    steel: 'Tamahagane · 15 pliegues',
    hamon: 'Chōji (flor de clavo)',
    weight: '1.095 g',
    lead: '8 semanas',
    stock: 4,
    img: 'prod-hanabira',
    accent: '#9a6b5e',
  },
  {
    id: 'arashi',
    name: 'Arashi',
    kanji: '嵐',
    tagline: 'La tormenta plegada.',
    claim: 'Damasco de 8.192 capas con jihada de madera.',
    base: 3120,
    steel: 'Damasco · 13 pliegues',
    hamon: 'Gunome-midare',
    weight: '1.140 g',
    lead: '9 semanas',
    stock: 3,
    img: 'prod-arashi',
    accent: '#54606b',
  },
  {
    id: 'tsuki',
    name: 'Tsuki',
    kanji: '月',
    tagline: 'Kissaki de luna llena.',
    claim: 'Ō-kissaki alargado, pulido hadori a espejo.',
    base: 2460,
    steel: 'Tamahagane · 13 pliegues',
    hamon: 'Suguha con ashi',
    weight: '1.060 g',
    lead: '7 semanas',
    stock: 6,
    img: 'prod-tsuki',
    accent: '#8b8f97',
  },
  {
    id: 'ryujin',
    name: 'Ryūjin',
    kanji: '龍神',
    tagline: 'Edición de nueve piezas.',
    claim: 'Horimono de dragón grabado a buril por Ōtani-shi.',
    base: 4900,
    steel: 'Tamahagane · 16 pliegues',
    hamon: 'Hitatsura (temple total)',
    weight: '1.180 g',
    lead: '14 semanas',
    stock: 2,
    limited: true,
    img: 'prod-ryujin',
    accent: '#7a5c2e',
  },
];

export const productById = (id) => PRODUCTS.find((p) => p.id === id);

export const optionGroup = (id) => OPTION_GROUPS.find((g) => g.id === id);

export const optionById = (groupId, optionId) => optionGroup(groupId)?.options.find((o) => o.id === optionId);

export const DEFAULT_VARIANTS = Object.fromEntries(
  OPTION_GROUPS.map((g) => [g.id, g.options.find((o) => o.delta === 0)?.id || g.options[0].id]),
);

/** Precio de una configuración concreta. */
export function priceOf(productId, variants = DEFAULT_VARIANTS, engraving = '') {
  const product = productById(productId);
  if (!product) return 0;
  let total = product.base;
  for (const group of OPTION_GROUPS) {
    const opt = optionById(group.id, variants[group.id]);
    if (opt) total += opt.delta;
  }
  if (engraving && engraving.trim()) total += ENGRAVING_PRICE;
  return total;
}

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurCents = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

export const formatPrice = (value) => (Number.isInteger(value) ? eur.format(value) : eurCents.format(value));

/** Descripción legible de una configuración: "71 cm · Espejo · Aoi · Negro urushi". */
export function describeVariants(variants) {
  return OPTION_GROUPS.map((g) => optionById(g.id, variants[g.id])?.label).filter(Boolean).join(' · ');
}
