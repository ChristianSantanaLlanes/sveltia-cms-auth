import { useId, type ReactElement } from 'react';
import type { BodyStyle, PaintOption, WheelOption } from '@/types';
import { Wheel, RimDefs } from './rims';
import './CarRender.css';

export interface CarRenderProps {
  body: BodyStyle;
  paint: PaintOption;
  wheel: WheelOption;
  view?: 'front-3q' | 'side';
  ground?: boolean;
  className?: string;
  label?: string;
}

type View = NonNullable<CarRenderProps['view']>;

interface WheelSpot {
  cx: number;
  cy: number;
  r: number;
  squash: number;
  /** Far-side wheel: no arch liner, heavily shaded, drawn behind the body. */
  far?: boolean;
  shade?: number;
  /** Arch opening this wheel sits in — the liner is drawn to match exactly. */
  arch?: { y: number; rx: number; ry: number };
}

/** Vertical stops, in stage units, for the gradients that follow the body. */
interface Bands {
  paint: [number, number];
  top: [number, number];
  rocker: [number, number];
  glass: [number, number];
  /** Height of the sill — the underbody shadow starts here. */
  sill: number;
}

interface Geometry {
  outline: string;
  /** Three-quarter views only: hood, roof and deck seen from above. */
  shell?: string;
  hoodLines?: string[];
  /** Panel folds that catch a rim highlight — nose crown, fender crowns. */
  folds?: string[];
  mirrorFar?: string;
  glass: string;
  glassRef: string;
  pillars: string[];
  doors: string[];
  handles: [number, number][];
  /** Broad studio-strip reflection across hood and roof. */
  sweep: string;
  /** Crisp shoulder crease down the flank. */
  shoulder: string;
  /** Wide, soft paint reflection along the doors. */
  band: string;
  /** Narrow near-white horizon line on the flank. */
  horizon: string;
  taillight: string;
  headlight?: string;
  /** Front three-quarter only. */
  face?: string;
  /** Closed lens shape for the front light bar, plus its dark housing. */
  ledBar?: string;
  lampHousing?: string;
  intake?: string;
  lip?: string;
  crease?: string;
  mirror: string;
  /** Dark lower trim: valance, intake surrounds, diffuser. */
  trim?: string[];
  /** Hairline panel gaps around the bumpers. */
  gaps?: string[];
  bands: Bands;
  wheels: WheelSpot[];
}

/* ── Geometry ─────────────────────────────────────────────────────────────
   All four drawings share a 1200 × 420 stage with the floor at y = 340.
   Coordinates are projected from real vehicle dimensions — a 4.72 m sedan and
   a 4.75 m SUV — so ride height, wheelbase and glasshouse read true. The
   three-quarter views use an oblique projection: 55° off the car's axis, which
   foreshortens the wheels to 0.835 and pushes the far side up and to the left.
   Nothing here depends on the props, so a paint or wheel change cannot move a
   single vertex.                                                             */

const VIEW_W = 1200;
const VIEW_H = 420;
const FLOOR = 340;
/** Wheels are seen at 55° in the three-quarter views. */
const SQUASH = 0.835;

const SEDAN_SIDE: Geometry = {
  outline: [
    'M 146,170',
    'C 250,158 348,146 430,130',
    'C 470,96 522,63 592,54',
    'C 660,48 738,50 790,58',
    'C 862,76 928,108 982,140',
    'C 1024,152 1058,158 1076,164',
    'C 1088,178 1090,204 1084,234',
    'C 1078,264 1064,282 1042,288',
    'C 1010,290 984,278 961,262',
    'A 80 74 0 0 0 801,262',
    'C 762,272 430,276 361,268',
    'A 78 74 0 0 0 205,268',
    'C 190,282 168,296 152,306',
    'C 128,292 110,260 111,226',
    'C 114,196 126,178 146,170',
    'Z',
  ].join(' '),
  glass: [
    'M 444,128',
    'C 484,96 532,68 596,60',
    'L 782,64',
    'C 838,80 890,104 928,130',
    'C 800,132 600,132 444,128',
    'Z',
  ].join(' '),
  glassRef: 'M 448,128 C 486,97 534,69 598,61 L 626,62 C 570,72 520,100 480,132 Z',
  pillars: ['M 678,132 L 698,132 L 702,52 L 682,51 Z', 'M 846,140 L 866,143 L 894,110 L 874,102 Z'],
  doors: [
    'M 506,130 C 502,178 502,228 500,262',
    'M 682,133 C 678,184 678,232 676,266',
    'M 846,140 C 842,186 840,228 838,264',
  ],
  handles: [
    [540, 156],
    [716, 160],
  ],
  sweep: 'M 110,120 C 380,40 760,26 1090,116 L 1090,152 C 760,62 380,76 110,158 Z',
  shoulder: 'M 330,178 C 540,178 810,190 1014,202',
  band: 'M 318,192 C 540,192 810,206 1018,218 L 1016,248 C 810,236 540,218 316,218 Z',
  horizon: 'M 322,186 C 540,186 810,198 1016,210 L 1015,217 C 810,205 540,193 321,193 Z',
  headlight: 'M 118,192 C 142,184 168,177 190,175 L 196,196 C 172,197 146,204 124,213 Z',
  taillight: 'M 1030,174 C 1050,177 1068,181 1082,186 L 1078,207 C 1064,201 1046,196 1026,193 Z',
  mirror: 'M 440,126 C 424,120 410,124 406,133 L 430,139 Z',
  trim: [
    'M 152,288 C 172,278 192,272 208,269 L 210,280 C 194,284 172,292 156,300 Z',
    'M 998,276 C 1016,281 1032,284 1044,284 L 1042,290 C 1028,291 1012,288 996,284 Z',
  ],
  gaps: ['M 214,192 C 206,226 200,252 196,268', 'M 1028,200 C 1032,234 1036,258 1040,274'],
  bands: { paint: [44, 300], top: [44, 150], rocker: [180, 272], glass: [48, 140], sill: 268 },
  wheels: [
    { cx: 283, cy: 272, r: 68, squash: 1, arch: { y: 268, rx: 78, ry: 74 } },
    { cx: 881, cy: 272, r: 68, squash: 1, shade: 0.07, arch: { y: 262, rx: 80, ry: 74 } },
  ],
};

const SUV_SIDE: Geometry = {
  outline: [
    'M 168,154',
    'C 252,142 344,128 410,112',
    'C 444,84 500,42 560,30',
    'C 640,20 742,20 812,26',
    'C 872,36 928,54 968,78',
    'C 1006,100 1036,122 1052,146',
    'C 1064,166 1066,200 1060,238',
    'C 1056,268 1044,288 1022,292',
    'C 998,292 976,272 958,250',
    'A 82 60 0 0 0 794,250',
    'C 752,262 430,264 392,250',
    'A 82 60 0 0 0 228,250',
    'C 206,266 180,288 160,304',
    'C 140,292 130,258 132,226',
    'C 136,192 148,168 168,154',
    'Z',
  ].join(' '),
  glass: [
    'M 424,108',
    'C 456,80 508,44 566,36',
    'L 806,40',
    'C 866,52 918,70 954,92',
    'C 820,100 600,110 424,108',
    'Z',
  ].join(' '),
  glassRef: 'M 428,108 C 458,81 510,45 568,37 L 596,38 C 542,50 502,80 470,112 Z',
  pillars: ['M 668,110 L 688,110 L 690,32 L 670,31 Z', 'M 810,102 L 830,101 L 826,42 L 806,42 Z'],
  doors: [
    'M 494,110 C 490,158 490,210 488,244',
    'M 670,110 C 666,162 666,214 664,248',
    'M 814,102 C 810,154 808,204 806,244',
  ],
  handles: [
    [528, 138],
    [702, 142],
  ],
  sweep: 'M 120,96 C 400,16 760,4 1080,92 L 1080,128 C 760,40 400,52 120,134 Z',
  shoulder: 'M 330,158 C 540,158 812,170 1004,182',
  band: 'M 320,174 C 540,172 812,186 1006,198 L 1004,228 C 812,216 540,198 318,200 Z',
  horizon: 'M 324,168 C 540,166 812,178 1004,190 L 1003,197 C 812,185 540,173 323,175 Z',
  headlight: 'M 140,174 C 164,166 190,158 212,156 L 218,177 C 194,178 168,185 146,194 Z',
  taillight: 'M 1018,150 C 1036,157 1052,164 1064,171 L 1054,192 C 1042,184 1026,177 1010,171 Z',
  mirror: 'M 420,106 C 404,100 390,104 386,113 L 410,119 Z',
  trim: [
    'M 218,250 A 92 70 0 0 1 402,250 L 392,250 A 82 60 0 0 0 228,250 Z',
    'M 784,250 A 92 70 0 0 1 968,250 L 958,250 A 82 60 0 0 0 794,250 Z',
    'M 236,258 C 480,270 720,270 950,258 L 950,268 C 720,280 480,280 234,268 Z',
    'M 160,282 C 184,270 206,262 222,258 L 226,268 C 208,272 186,282 164,294 Z',
    'M 976,268 C 1000,276 1020,280 1034,281 L 1030,290 C 1014,289 994,284 970,276 Z',
  ],
  gaps: ['M 232,176 C 224,208 218,234 216,252', 'M 1000,178 C 1006,212 1010,238 1012,258'],
  bands: { paint: [22, 302], top: [22, 136], rocker: [166, 254], glass: [30, 114], sill: 252 },
  wheels: [
    { cx: 310, cy: 270, r: 70, squash: 1, arch: { y: 250, rx: 82, ry: 60 } },
    { cx: 876, cy: 270, r: 70, squash: 1, shade: 0.07, arch: { y: 250, rx: 82, ry: 60 } },
  ],
};

const SEDAN_3Q: Geometry = {
  shell: [
    'M 186,142',
    'C 254,132 344,120 412,104',
    'C 448,74 486,42 539,31',
    'C 595,26 658,28 701,35',
    'C 760,53 814,84 858,116',
    'C 892,128 920,133 935,139',
    'L 1100,167',
    'C 1085,161 1057,156 1023,144',
    'C 979,112 925,81 866,63',
    'C 823,56 760,54 704,59',
    'C 647,68 604,101 572,134',
    'C 505,150 424,161 339,173',
    'C 296,152 240,133 186,142',
    'Z',
  ].join(' '),
  outline: [
    'M 339,173',
    'C 424,161 505,150 572,134',
    'C 604,101 647,68 704,59',
    'C 760,54 823,56 866,63',
    'C 925,81 979,112 1023,144',
    'C 1057,156 1085,161 1100,167',
    'C 1109,181 1111,207 1106,236',
    'C 1101,265 1090,283 1072,289',
    'C 1046,291 1024,279 1006,263',
    'A 65 73 0 0 0 875,263',
    'C 843,273 572,277 515,269',
    'A 64 73 0 0 0 388,269',
    'C 372,279 354,289 343,299',
    'C 341,250 340,200 339,173',
    'Z',
  ].join(' '),
  face: [
    'M 339,173',
    'C 296,152 240,133 186,142',
    'C 168,150 161,176 161,206',
    'C 161,240 171,262 186,275',
    'C 236,291 298,300 343,299',
    'C 353,250 346,202 339,173',
    'Z',
  ].join(' '),
  glass: [
    'M 418,104',
    'C 448,74 486,45 542,37',
    'C 600,46 650,56 707,65',
    'L 859,69',
    'C 905,85 947,109 979,134',
    'C 874,136 710,136 583,132',
    'L 418,104',
    'Z',
  ].join(' '),
  glassRef: 'M 422,104 C 451,75 489,46 544,38 L 578,41 C 532,52 494,80 466,110 Z',
  pillars: [
    'M 578,133 L 597,134 L 721,67 L 704,62 Z',
    'M 774,136 L 791,136 L 794,58 L 777,57 Z',
    'M 912,144 L 928,147 L 951,114 L 934,107 Z',
  ],
  hoodLines: ['M 352,167 C 432,156 508,145 572,131', 'M 186,155 C 268,143 348,132 416,116'],
  doors: [
    'M 634,134 C 630,181 630,230 629,263',
    'M 777,137 C 774,187 774,234 773,267',
    'M 912,144 C 908,189 907,230 905,265',
  ],
  handles: [
    [661, 158],
    [805, 161],
  ],
  sweep: 'M 190,144 C 320,124 430,86 560,50 L 580,66 C 450,104 336,142 200,164 Z',
  shoulder: 'M 490,181 C 661,181 882,193 1049,205',
  band: 'M 480,195 C 661,195 882,209 1052,220 L 1050,250 C 882,238 661,220 478,220 Z',
  horizon: 'M 483,189 C 661,189 882,201 1050,212 L 1050,219 C 882,208 661,196 482,196 Z',
  taillight: 'M 1044,190 C 1068,193 1090,199 1104,206 L 1101,218 C 1088,212 1066,205 1042,201 Z',
  lampHousing: 'M 188,144 C 244,139 292,157 344,182 L 342,201 C 290,176 242,157 186,163 Z',
  ledBar: 'M 194,150 C 246,146 292,163 340,186 L 339,195 C 291,172 245,154 192,159 Z',
  intake: 'M 182,240 C 238,266 296,280 341,280 L 342,294 C 296,296 234,284 180,258 Z',
  lip: 'M 182,266 C 236,290 300,300 342,300',
  crease: 'M 339,173 C 341,220 342,260 343,299',
  folds: [
    'M 339,173 C 296,152 240,133 186,142',
    'M 190,141 C 254,131 340,121 407,105',
    'M 344,172 C 428,160 508,149 574,133',
  ],
  mirror: 'M 580,130 C 567,124 555,128 552,137 L 572,143 Z',
  mirrorFar: 'M 415,100 C 402,94 390,98 387,107 L 407,113 Z',
  trim: ['M 1018,274 C 1040,284 1058,290 1070,292 L 1066,298 C 1052,296 1034,290 1014,280 Z'],
  gaps: ['M 1046,208 C 1054,234 1058,258 1058,276'],
  bands: { paint: [26, 300], top: [26, 152], rocker: [186, 280], glass: [34, 140], sill: 269 },
  wheels: [
    { cx: 286, cy: 245, r: 67, squash: 0.88, far: true, shade: 0.48 },
    { cx: 451, cy: 273, r: 67, squash: 0.88, arch: { y: 269, rx: 66, ry: 73 } },
    { cx: 940, cy: 273, r: 67, squash: 0.88, shade: 0.1, arch: { y: 263, rx: 67, ry: 73 } },
  ],
};

const SUV_3Q: Geometry = {
  shell: [
    'M 204,144',
    'C 268,134 334,121 389,106',
    'C 416,82 458,46 502,34',
    'C 565,25 646,25 701,30',
    'C 749,39 793,55 824,77',
    'C 854,97 878,117 891,139',
    'L 1052,163',
    'C 1039,141 1015,121 985,101',
    'C 954,79 910,63 862,54',
    'C 807,49 726,49 663,58',
    'C 616,69 571,107 545,132',
    'C 492,147 420,160 353,171',
    'C 310,152 258,135 204,144',
    'Z',
  ].join(' '),
  outline: [
    'M 353,171',
    'C 420,160 492,147 545,132',
    'C 571,107 616,69 663,58',
    'C 726,49 807,49 862,54',
    'C 910,63 954,79 985,101',
    'C 1015,121 1039,141 1052,163',
    'C 1061,182 1063,213 1058,247',
    'C 1055,274 1045,293 1028,296',
    'C 1009,296 992,278 978,258',
    'A 65 55 0 0 0 848,258',
    'C 815,269 560,271 530,258',
    'A 65 55 0 0 0 401,258',
    'C 382,269 360,285 346,300',
    'C 349,250 351,205 353,171',
    'Z',
  ].join(' '),
  face: [
    'M 353,171',
    'C 310,152 258,135 204,144',
    'C 186,152 179,180 179,212',
    'C 179,248 188,268 200,280',
    'C 246,294 302,302 346,300',
    'C 356,248 358,205 353,171',
    'Z',
  ].join(' '),
  glass: [
    'M 395,105',
    'C 420,79 461,46 507,39',
    'C 570,48 620,56 668,63',
    'L 857,67',
    'C 905,78 946,94 974,114',
    'C 868,121 695,131 556,129',
    'L 395,105',
    'Z',
  ].join(' '),
  glassRef: 'M 399,105 C 423,80 463,48 509,40 L 543,43 C 500,54 462,84 440,110 Z',
  pillars: [
    'M 551,130 L 570,131 L 682,65 L 665,60 Z',
    'M 748,131 L 764,131 L 766,59 L 750,59 Z',
    'M 861,123 L 876,122 L 873,69 L 857,69 Z',
  ],
  hoodLines: ['M 366,166 C 428,156 496,144 546,130', 'M 204,157 C 268,146 338,133 392,118'],
  doors: [
    'M 611,131 C 608,174 608,222 606,253',
    'M 750,131 C 747,178 747,225 745,256',
    'M 864,123 C 861,171 859,216 857,253',
  ],
  handles: [
    [638, 152],
    [775, 156],
  ],
  sweep: 'M 208,146 C 330,126 440,84 560,44 L 580,60 C 458,102 344,144 216,166 Z',
  shoulder: 'M 481,174 C 647,174 862,185 1014,196',
  band: 'M 474,189 C 647,187 862,200 1015,211 L 1014,238 C 862,227 647,211 472,213 Z',
  horizon: 'M 477,183 C 647,182 862,192 1014,203 L 1013,210 C 862,199 647,188 476,190 Z',
  taillight: 'M 998,196 C 1018,200 1036,206 1048,212 L 1045,224 C 1032,218 1014,211 996,207 Z',
  lampHousing: 'M 206,146 C 260,141 306,159 356,184 L 354,203 C 302,178 256,159 204,165 Z',
  ledBar: 'M 212,152 C 262,148 306,165 352,188 L 351,197 C 303,174 259,156 210,161 Z',
  intake: 'M 198,246 C 250,272 304,284 346,284 L 347,298 C 304,300 248,288 196,264 Z',
  lip: 'M 192,270 C 246,294 306,304 346,304',
  crease: 'M 353,171 C 349,215 347,258 346,300',
  folds: [
    'M 353,171 C 310,152 258,135 204,144',
    'M 208,143 C 268,133 331,122 384,107',
    'M 358,170 C 424,159 494,146 547,131',
  ],
  mirror: 'M 552,127 C 540,121 529,125 526,133 L 545,139 Z',
  mirrorFar: 'M 391,101 C 379,95 368,99 365,107 L 384,113 Z',
  trim: [
    'M 392,258 A 75 65 0 0 1 540,258 L 530,258 A 65 55 0 0 0 401,258 Z',
    'M 839,258 A 75 65 0 0 1 987,258 L 978,258 A 65 55 0 0 0 848,258 Z',
    'M 536,264 C 660,270 780,270 844,264 L 844,274 C 780,281 660,281 534,274 Z',
  ],
  gaps: ['M 1000,212 C 1008,238 1012,262 1012,280'],
  bands: { paint: [25, 300], top: [25, 152], rocker: [180, 286], glass: [38, 132], sill: 258 },
  wheels: [
    { cx: 305, cy: 252, r: 64, squash: 0.9, far: true, shade: 0.48 },
    { cx: 466, cy: 276, r: 64, squash: 0.9, arch: { y: 258, rx: 67, ry: 56 } },
    { cx: 913, cy: 276, r: 64, squash: 0.9, shade: 0.1, arch: { y: 258, rx: 67, ry: 56 } },
  ],
};

const GEOMETRY: Record<string, Geometry> = {
  'sedan|side': SEDAN_SIDE,
  'suv|side': SUV_SIDE,
  'sedan|front-3q': SEDAN_3Q,
  'suv|front-3q': SUV_3Q,
};

/** Overall tyre diameter grows slightly with rim size, as on a real car. */
function tyreScale(size: number): number {
  return 1 + (Math.min(22, Math.max(17, size)) - 18) * 0.011;
}

function describe(body: BodyStyle, paint: PaintOption, wheel: WheelOption, view: View): string {
  const shape = body === 'suv' ? 'SUV' : 'sedan';
  const angle = view === 'side' ? 'side profile' : 'front three-quarter view';
  return `Vela ${shape} in ${paint.name} with ${wheel.name}, ${angle}`;
}

export default function CarRender({
  body,
  paint,
  wheel,
  view = 'front-3q',
  ground = true,
  className,
  label,
}: CarRenderProps): ReactElement {
  const uid = `c${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const g = GEOMETRY[`${body}|${view}`] ?? SEDAN_3Q;
  const scale = tyreScale(wheel.size);
  const b = g.bands;
  const grounded = g.wheels.filter((w) => !w.far);

  return (
    <svg
      className={className ? `car-render ${className}` : 'car-render'}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label ?? describe(body, paint, wheel, view)}
    >
      <defs>
        {/* Paint-driven body gradient: sky sheen along the roof, body colour
            through the flank, deep shade down in the rocker. */}
        <linearGradient id={`${uid}-paint`} gradientUnits="userSpaceOnUse" x1="0" y1={b.paint[0]} x2="0" y2={b.paint[1]}>
          <stop offset="0" stopColor={paint.sheen} data-paint />
          <stop offset="0.12" stopColor={paint.hex} data-paint />
          <stop offset="0.5" stopColor={paint.hex} data-paint />
          <stop offset="0.82" stopColor={paint.shade} data-paint />
          <stop offset="1" stopColor={paint.shade} data-paint />
        </linearGradient>
        {/* The front face turns toward the light, so it stays lighter than the flank. */}
        <linearGradient id={`${uid}-face`} gradientUnits="userSpaceOnUse" x1="152" y1="0" x2="352" y2="0">
          <stop offset="0" stopColor={paint.shade} data-paint />
          <stop offset="0.38" stopColor={paint.hex} data-paint />
          <stop offset="1" stopColor={paint.hex} data-paint />
        </linearGradient>
        <linearGradient id={`${uid}-face-lit`} gradientUnits="userSpaceOnUse" x1="0" y1={b.paint[0] + 100} x2="0" y2={b.paint[0] + 220}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-rocker`} gradientUnits="userSpaceOnUse" x1="0" y1={b.rocker[0]} x2="0" y2={b.rocker[1]}>
          <stop offset="0" stopColor={paint.shade} stopOpacity="0" data-paint />
          <stop offset="0.62" stopColor={paint.shade} stopOpacity="0.38" data-paint />
          <stop offset="1" stopColor={paint.shade} stopOpacity="0.9" data-paint />
        </linearGradient>
        {/* Long reflections run with the car, so they fade along x, not y. */}
        <linearGradient id={`${uid}-band`} gradientUnits="userSpaceOnUse" x1="260" y1="0" x2="1080" y2="0">
          <stop offset="0" stopColor={paint.sheen} stopOpacity="0" data-paint />
          <stop offset="0.22" stopColor={paint.sheen} stopOpacity="0.4" data-paint />
          <stop offset="0.68" stopColor={paint.sheen} stopOpacity="0.14" data-paint />
          <stop offset="1" stopColor={paint.shade} stopOpacity="0.2" data-paint />
        </linearGradient>
        {/* Near-white specular strips — deliberately not paint-tinted. */}
        <linearGradient id={`${uid}-horizon`} gradientUnits="userSpaceOnUse" x1="260" y1="0" x2="1080" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.72" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-sweep`} gradientUnits="userSpaceOnUse" x1="140" y1="0" x2="1090" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.24" stopColor="#ffffff" stopOpacity="0.36" />
          <stop offset="0.66" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-shoulder`} gradientUnits="userSpaceOnUse" x1="300" y1="0" x2="1060" y2="0">
          <stop offset="0" stopColor={paint.sheen} stopOpacity="0" data-paint />
          <stop offset="0.34" stopColor={paint.sheen} stopOpacity="0.9" data-paint />
          <stop offset="1" stopColor={paint.sheen} stopOpacity="0" data-paint />
        </linearGradient>
        <linearGradient id={`${uid}-shell`} gradientUnits="userSpaceOnUse" x1="0" y1={b.top[0]} x2="0" y2={b.top[1] + 40}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.11" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-top`} gradientUnits="userSpaceOnUse" x1="0" y1={b.top[0]} x2="0" y2={b.top[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Glass never takes the body colour. */}
        <linearGradient id={`${uid}-glass`} gradientUnits="userSpaceOnUse" x1="420" y1={b.glass[0]} x2="880" y2={b.glass[1] + 20}>
          <stop offset="0" stopColor="#6c7885" />
          <stop offset="0.32" stopColor="#333d47" />
          <stop offset="0.7" stopColor="#1b2128" />
          <stop offset="1" stopColor="#0d1116" />
        </linearGradient>
        <linearGradient id={`${uid}-glass-in`} gradientUnits="userSpaceOnUse" x1="0" y1={b.glass[0] + 24} x2="0" y2={b.glass[1] + 6}>
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.66" />
        </linearGradient>

        <linearGradient id={`${uid}-led`} gradientUnits="userSpaceOnUse" x1="110" y1="0" x2="350" y2="0">
          <stop offset="0" stopColor="#c9dcff" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#a5c1ee" />
        </linearGradient>
        <linearGradient id={`${uid}-lamp`} gradientUnits="userSpaceOnUse" x1="115" y1="0" x2="215" y2="0">
          <stop offset="0" stopColor="#ffe9c4" />
          <stop offset="0.55" stopColor="#ffffff" />
          <stop offset="1" stopColor="#b9cde8" />
        </linearGradient>
        <linearGradient id={`${uid}-tail`} gradientUnits="userSpaceOnUse" x1="1020" y1="0" x2="1100" y2="0">
          <stop offset="0" stopColor="#f2543e" />
          <stop offset="1" stopColor="#9d0f18" />
        </linearGradient>

        <linearGradient id={`${uid}-under`} gradientUnits="userSpaceOnUse" x1="0" y1={b.sill} x2="0" y2={FLOOR + 4}>
          <stop offset="0" stopColor="#0b0e12" stopOpacity="0.66" />
          <stop offset="0.55" stopColor="#0b0e12" stopOpacity="0.3" />
          <stop offset="1" stopColor="#0b0e12" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0b0e12" stopOpacity="0.5" />
          <stop offset="0.62" stopColor="#0b0e12" stopOpacity="0.22" />
          <stop offset="1" stopColor="#0b0e12" stopOpacity="0" />
        </radialGradient>

        <RimDefs uid={uid} />

        <filter id={`${uid}-blur-soft`} x="-25%" y="-200%" width="150%" height="500%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <filter id={`${uid}-blur-tight`} x="-60%" y="-300%" width="220%" height="700%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>

        <clipPath id={`${uid}-clip-body`}>
          {g.shell && <path d={g.shell} />}
          <path d={g.outline} />
          {g.face && <path d={g.face} />}
        </clipPath>
        <clipPath id={`${uid}-clip-glass`}>
          <path d={g.glass} />
        </clipPath>
        <linearGradient id={`${uid}-fade`} gradientUnits="userSpaceOnUse" x1="0" y1={FLOOR} x2="0" y2={FLOOR + 62}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${uid}-mask-floor`} maskUnits="userSpaceOnUse" x="0" y={FLOOR} width={VIEW_W} height={VIEW_H - FLOOR}>
          <rect x="0" y={FLOOR} width={VIEW_W} height={VIEW_H - FLOOR} fill={`url(#${uid}-fade)`} />
        </mask>
      </defs>

      {ground && (
        <g className="car-render__floor" mask={`url(#${uid}-mask-floor)`} opacity="0.12">
          <use href={`#${uid}-car`} transform={`matrix(1 0 0 -1 0 ${FLOOR * 2})`} />
        </g>
      )}

      {ground && (
        <g className="car-render__shadow">
          <ellipse
            cx={(grounded[0].cx + grounded[grounded.length - 1].cx) / 2}
            cy={FLOOR}
            rx={(grounded[grounded.length - 1].cx - grounded[0].cx) / 2 + 118}
            ry="17"
            fill={`url(#${uid}-shadow)`}
            filter={`url(#${uid}-blur-soft)`}
          />
          <g filter={`url(#${uid}-blur-tight)`}>
            {grounded.map((w) => (
              <ellipse key={w.cx} cx={w.cx} cy={FLOOR - 1} rx={w.r * w.squash * 0.95} ry="7" fill="#0b0e12" opacity="0.45" />
            ))}
          </g>
        </g>
      )}

      <g id={`${uid}-car`}>
        {/* Everything the eye reads as "planted": the dark air under the sill,
            then an arch liner cut to the same ellipse as each opening. */}
        <path
          d={`M ${grounded[0].cx},${b.sill} L ${grounded[grounded.length - 1].cx},${b.sill} L ${
            grounded[grounded.length - 1].cx - 26
          },${FLOOR} L ${grounded[0].cx + 26},${FLOOR} Z`}
          fill={`url(#${uid}-under)`}
          filter={`url(#${uid}-blur-tight)`}
        />
        {grounded.map((w) =>
          w.arch ? (
            <ellipse key={w.cx} cx={w.cx} cy={w.arch.y} rx={w.arch.rx} ry={w.arch.ry} fill="#0a0c0f" />
          ) : null
        )}

        {g.wheels.map((w) => (
          <Wheel
            key={w.cx}
            uid={uid}
            style={wheel.style}
            size={wheel.size}
            cx={w.cx}
            cy={w.cy}
            r={w.r * scale}
            squash={w.squash}
            shade={w.shade}
          />
        ))}

        {/* Body panels: the upward-facing shell first, then the near flank,
            then the front fascia that wraps around the nose. */}
        {g.shell && <path d={g.shell} fill={`url(#${uid}-paint)`} data-paint />}
        <path d={g.outline} fill={`url(#${uid}-paint)`} data-paint />

        <g clipPath={`url(#${uid}-clip-body)`}>
          <rect x="0" y={b.top[0]} width={VIEW_W} height={b.top[1] - b.top[0]} fill={`url(#${uid}-top)`} />
          {g.shell && <path d={g.shell} fill={`url(#${uid}-shell)`} />}
          <path d={g.sweep} fill={`url(#${uid}-sweep)`} />
          <rect x="0" y={b.rocker[0]} width={VIEW_W} height={b.rocker[1] - b.rocker[0]} fill={`url(#${uid}-rocker)`} data-paint />
          {g.face && (
            <>
              <path d={g.face} fill={`url(#${uid}-face)`} data-paint />
              <path d={g.face} fill={`url(#${uid}-face-lit)`} />
            </>
          )}
          {g.folds && (
            <g fill="none" stroke="#ffffff" strokeLinecap="round">
              {g.folds.map((d) => (
                <path key={d} d={d} strokeOpacity="0.3" strokeWidth="6" filter={`url(#${uid}-blur-tight)`} />
              ))}
              {g.folds.map((d) => (
                <path key={`${d}-crisp`} d={d} strokeOpacity="0.34" strokeWidth="1.6" />
              ))}
            </g>
          )}
          {/* Soft shadow hugging the top of each arch — clipped to the body, so
              only the half that lands on sheet metal survives. */}
          {grounded.map((w) =>
            w.arch ? (
              <ellipse
                key={w.cx}
                cx={w.cx}
                cy={w.arch.y}
                rx={w.arch.rx + 7}
                ry={w.arch.ry + 7}
                fill="none"
                stroke="#05070a"
                strokeOpacity="0.38"
                strokeWidth="14"
                filter={`url(#${uid}-blur-tight)`}
              />
            ) : null
          )}
          <path d={g.band} fill={`url(#${uid}-band)`} data-paint />
          <path d={g.horizon} fill={`url(#${uid}-horizon)`} />
          <path
            d={g.shoulder}
            fill="none"
            stroke={`url(#${uid}-shoulder)`}
            strokeWidth="2.4"
            strokeLinecap="round"
            data-paint
          />
          {g.crease && (
            <>
              <path
                d={g.crease}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.26"
                strokeWidth="9"
                strokeLinecap="round"
                filter={`url(#${uid}-blur-tight)`}
              />
              <path d={g.crease} fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="1.8" strokeLinecap="round" />
            </>
          )}
        </g>

        {/* Glasshouse */}
        <path d={g.glass} fill={`url(#${uid}-glass)`} />
        <g clipPath={`url(#${uid}-clip-glass)`}>
          <rect x="0" y={b.glass[0]} width={VIEW_W} height={b.glass[1] - b.glass[0] + 24} fill={`url(#${uid}-glass-in)`} />
          <path d={g.glassRef} fill="#ffffff" opacity="0.11" />
        </g>
        <path d={g.glass} fill="none" stroke="#0a0d10" strokeOpacity="0.45" strokeWidth="1.8" />
        <g fill="#16191d">
          {g.pillars.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* Panel gaps and door furniture */}
        <g fill="none" stroke="#0a0d10" strokeOpacity="0.22" strokeWidth="1.4" strokeLinecap="round">
          {g.doors.map((d) => (
            <path key={d} d={d} />
          ))}
          {g.hoodLines?.map((d) => (
            <path key={d} d={d} strokeOpacity="0.16" />
          ))}
        </g>
        {g.handles.map(([hx, hy]) => (
          <rect
            key={`${hx}-${hy}`}
            x={hx}
            y={hy}
            width="30"
            height="5"
            rx="2.5"
            fill="#ffffff"
            fillOpacity="0.32"
            transform={`rotate(2 ${hx} ${hy})`}
          />
        ))}
        {g.mirrorFar && (
          <>
            <path d={g.mirrorFar} fill={`url(#${uid}-face)`} data-paint />
            <path d={g.mirrorFar} fill="#000000" opacity="0.3" />
          </>
        )}
        <path d={g.mirror} fill={`url(#${uid}-face)`} data-paint />
        <path d={g.mirror} fill="#000000" opacity="0.16" />

        {/* Lower trim and bumper cuts */}
        {g.trim?.map((d) => (
          <path key={d} d={d} fill="#12151a" fillOpacity="0.82" />
        ))}
        {g.gaps && (
          <g fill="none" stroke="#0a0d10" strokeOpacity="0.26" strokeWidth="1.4" strokeLinecap="round">
            {g.gaps.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        )}

        {/* Lighting */}
        {g.intake && <path d={g.intake} fill="#0e1114" fillOpacity="0.88" />}
        {g.lip && <path d={g.lip} fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round" />}
        {g.lampHousing && <path d={g.lampHousing} fill="#0c0f13" fillOpacity="0.92" />}
        {g.ledBar && (
          <>
            <path d={g.ledBar} fill="#ffcf96" opacity="0.6" filter={`url(#${uid}-blur-tight)`} />
            <path d={g.ledBar} fill={`url(#${uid}-led)`} />
          </>
        )}
        {g.headlight && (
          <g>
            <path d={g.headlight} fill="#ffc98a" opacity="0.5" filter={`url(#${uid}-blur-tight)`} />
            <path d={g.headlight} fill={`url(#${uid}-lamp)`} />
          </g>
        )}
        <path d={g.taillight} fill="#f2543e" opacity="0.45" filter={`url(#${uid}-blur-tight)`} />
        <path d={g.taillight} fill={`url(#${uid}-tail)`} />
      </g>
    </svg>
  );
}
