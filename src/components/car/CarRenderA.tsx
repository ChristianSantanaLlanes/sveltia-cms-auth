import { useId, type ReactElement } from 'react';
import type { BodyStyle, PaintOption, WheelOption } from '@/types';
import { RimDefs, Wheel, tyreRadius } from './rims';
import './CarRender.css';
import './CarRenderA.css';

export interface CarRenderAProps {
  body: BodyStyle;
  paint: PaintOption;
  wheel: WheelOption;
  view?: 'front-3q' | 'side';
  ground?: boolean;
  className?: string;
  label?: string;
}

type View = NonNullable<CarRenderAProps['view']>;

/* ─────────────────────────────────────────────────────────────────────────
   The car is authored once, in three dimensions, in units of one wheel
   diameter (W). A single pinhole camera projects it, so the two views are
   the same object seen twice rather than two drawings: wheels sit on the
   floor because their contact patch is at Y = 0, and the far side of the
   car foreshortens because it is genuinely further away.

   Sedan, in W:  length 6.35 · wheelbase 3.95 · front overhang 1.00 ·
   rear overhang 1.40 · roof 1.95 · beltline 1.30 · rocker 0.40 ·
   clearance 0.185 · track width 2.55. The cowl — the base of the A-pillar —
   lands at 2.16 W, well behind the front axle at 1.00 W.
   ───────────────────────────────────────────────────────────────────────*/

type P3 = [number, number, number];
type Pt = [number, number];

const VIEW_W = 1200;
const VIEW_H = 420;

/* ── colour ───────────────────────────────────────────────────────────── */

function chan(hex: string, i: number): number {
  const h = hex.replace('#', '');
  const s = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  return parseInt(s.slice(i * 2, i * 2 + 2), 16);
}

/** Blend two hex colours. Lets every gradient carry real intermediate tones
    instead of stepping between the three colours the paint ships with. */
function mix(a: string, b: string, t: number): string {
  const v = (i: number) => {
    const n = Math.round(chan(a, i) + (chan(b, i) - chan(a, i)) * t);
    return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  };
  return `#${v(0)}${v(1)}${v(2)}`;
}

/* ── curves ───────────────────────────────────────────────────────────── */

function fmt(pt: Pt): string {
  return `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`;
}

/** Catmull-Rom through every point: the continuous line a body panel has. */
function curve(pts: Pt[], close = false): string {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i: number): Pt => (close ? pts[(i + n) % n] : pts[Math.min(n - 1, Math.max(0, i))]);
  let d = `M ${fmt(pts[0])}`;
  const segs = close ? n : n - 1;
  for (let i = 0; i < segs; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += ` C ${fmt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])}`;
    d += ` ${fmt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${fmt(p2)}`;
  }
  return close ? `${d} Z` : d;
}

function poly(pts: Pt[], close = true): string {
  return `M ${pts.map(fmt).join(' L ')}${close ? ' Z' : ''}`;
}

/** Smooth y(x) through a sparse control list — how every tonal band on the
    flank gets its curvature from the body rather than from a ruler. */
function lane(pts: [number, number][]): (x: number) => number {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const n = pts.length;
  const slope = (i: number) => {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    return (ys[b] - ys[a]) / (xs[b] - xs[a] || 1);
  };
  return (x: number) => {
    if (x <= xs[0]) return ys[0] + slope(0) * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + slope(n - 1) * (x - xs[n - 1]);
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i += 1;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const m0 = slope(i) * h;
    const m1 = slope(i + 1) * h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * m1
    );
  };
}

const range = (n: number, a: number, b: number): number[] =>
  Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

/* ── the vehicles ─────────────────────────────────────────────────────── */

interface Spec {
  L: number;
  width: number;
  roof: number;
  belt: number;
  rockerY: number;
  axleF: number;
  axleR: number;
  archRX: number;
  archRY: number;
  hubY: number;
  /** Front bumper bottom → over the roof → rear bumper bottom. */
  upper: P3[];
  rearLower: P3[];
  rocker: P3[];
  frontLower: P3[];
  /** Far edge of the top surfaces, as [X, Z]. */
  crown: [number, number][];
  /** How far the nose bulges forward at the centreline. */
  bulge: number;
  /** Longitudinal lines the tonal bands hang from, as [X, Y]. */
  shoulder: [number, number][];
  beltLine: [number, number][];
  tuck: [number, number][];
  glass: [number, number][];
  bPillar: number;
  doors: number[];
  handles: [number, number][];
  mirror: { x: number; y: number };
  lampY: [number, number];
  lampX: number;
  tailY: [number, number];
  intake: { y: [number, number]; z: [number, number] };
  vent: { y: [number, number]; w: number };
  gill: [number, number];
}

const SEDAN: Spec = {
  L: 6.35,
  width: 2.55,
  roof: 1.945,
  belt: 1.37,
  rockerY: 0.4,
  axleF: 1.16,
  axleR: 5.06,
  archRX: 0.532,
  archRY: 0.521,
  hubY: 0.46,
  upper: [
    [0.165, 0.235, 0.3],
    [0.05, 0.42, 0.34],
    [0.005, 0.66, 0.34],
    [0.02, 0.88, 0.3],
    [0.105, 1.015, 0.24],
    [0.3, 1.105, 0.2],
    [0.72, 1.17, 0.12],
    [1.28, 1.215, 0.04],
    [1.78, 1.26, 0.04],
    [2.16, 1.315, 0.12],
    [2.52, 1.49, 0.2],
    [2.92, 1.71, 0.3],
    [3.24, 1.875, 0.4],
    [3.62, 1.945, 0.46],
    [4.02, 1.94, 0.46],
    [4.45, 1.86, 0.42],
    [4.95, 1.705, 0.36],
    [5.45, 1.49, 0.26],
    [5.86, 1.34, 0.18],
    [6.1, 1.275, 0.2],
    [6.26, 1.235, 0.24],
    [6.335, 1.12, 0.28],
    [6.35, 0.93, 0.28],
    [6.325, 0.71, 0.28],
    [6.26, 0.47, 0.3],
    [6.15, 0.32, 0.32],
    [5.94, 0.265, 0.3],
  ],
  rearLower: [
    [5.72, 0.3, 0.1],
    [5.62, 0.36, 0.02],
  ],
  rocker: [
    [4.1, 0.394, 0],
    [3.3, 0.39, 0],
    [2.5, 0.392, 0],
  ],
  frontLower: [
    [0.4, 0.35, 0.04],
    [0.26, 0.29, 0.16],
  ],
  crown: [
    [0.0, 2.24],
    [0.3, 2.3],
    [0.9, 2.42],
    [1.6, 2.47],
    [2.16, 2.42],
    [2.6, 2.28],
    [3.3, 2.12],
    [4.1, 2.1],
    [4.9, 2.18],
    [5.9, 2.34],
    [6.35, 2.3],
  ],
  bulge: 0.22,
  shoulder: [
    [0.3, 1.055],
    [0.95, 1.135],
    [1.6, 1.185],
    [2.4, 1.205],
    [3.3, 1.225],
    [4.2, 1.255],
    [5.0, 1.305],
    [5.72, 1.36],
    [6.2, 1.3],
  ],
  beltLine: [
    [2.16, 1.315],
    [2.62, 1.36],
    [3.4, 1.375],
    [4.3, 1.4],
    [5.1, 1.455],
    [5.62, 1.5],
  ],
  tuck: [
    [0.5, 0.74],
    [1.6, 0.765],
    [2.6, 0.745],
    [3.6, 0.73],
    [4.6, 0.745],
    [5.6, 0.79],
    [6.15, 0.77],
  ],
  glass: [
    [2.62, 1.375],
    [3.28, 1.855],
    [3.95, 1.865],
    [4.62, 1.735],
    [5.34, 1.475],
    [4.62, 1.425],
    [3.6, 1.39],
  ],
  bPillar: 3.62,
  doors: [2.24, 3.62, 4.7],
  handles: [
    [3.0, 1.295],
    [4.14, 1.325],
  ],
  mirror: { x: 2.5, y: 1.375 },
  lampY: [0.955, 1.02],
  lampX: 0.72,
  tailY: [1.09, 1.23],
  intake: { y: [0.32, 0.53], z: [0.62, 1.93] },
  vent: { y: [0.36, 0.7], w: 0.3 },
  gill: [1.78, 1.1],
};

const SUV: Spec = {
  L: 6.15,
  width: 2.7,
  roof: 2.275,
  belt: 1.56,
  rockerY: 0.48,
  axleF: 1.24,
  axleR: 5.12,
  archRX: 0.552,
  archRY: 0.541,
  hubY: 0.46,
  upper: [
    [0.2, 0.3, 0.32],
    [0.07, 0.5, 0.36],
    [0.01, 0.76, 0.36],
    [0.03, 1.0, 0.32],
    [0.11, 1.17, 0.26],
    [0.34, 1.28, 0.2],
    [0.85, 1.35, 0.12],
    [1.4, 1.395, 0.04],
    [1.86, 1.44, 0.04],
    [2.16, 1.52, 0.12],
    [2.46, 1.7, 0.2],
    [2.82, 1.96, 0.3],
    [3.16, 2.17, 0.4],
    [3.5, 2.255, 0.48],
    [4.1, 2.275, 0.5],
    [4.8, 2.265, 0.5],
    [5.34, 2.22, 0.46],
    [5.75, 2.13, 0.4],
    [5.96, 1.96, 0.32],
    [6.06, 1.72, 0.28],
    [6.11, 1.42, 0.26],
    [6.14, 1.04, 0.26],
    [6.11, 0.74, 0.28],
    [6.02, 0.48, 0.3],
    [5.86, 0.34, 0.3],
  ],
  rearLower: [
    [5.72, 0.38, 0.1],
    [5.62, 0.44, 0.02],
  ],
  rocker: [
    [4.2, 0.474, 0],
    [3.4, 0.47, 0],
    [2.6, 0.472, 0],
  ],
  frontLower: [
    [0.46, 0.42, 0.04],
    [0.31, 0.36, 0.18],
  ],
  crown: [
    [0.0, 2.36],
    [0.34, 2.44],
    [0.95, 2.56],
    [1.7, 2.6],
    [2.16, 2.54],
    [2.6, 2.4],
    [3.3, 2.24],
    [4.2, 2.2],
    [5.0, 2.26],
    [5.9, 2.44],
    [6.15, 2.4],
  ],
  bulge: 0.24,
  shoulder: [
    [0.34, 1.22],
    [1.0, 1.295],
    [1.7, 1.335],
    [2.5, 1.355],
    [3.4, 1.38],
    [4.3, 1.41],
    [5.1, 1.465],
    [5.8, 1.52],
    [6.1, 1.475],
  ],
  beltLine: [
    [2.16, 1.52],
    [2.66, 1.565],
    [3.4, 1.58],
    [4.3, 1.61],
    [5.1, 1.665],
    [5.66, 1.72],
  ],
  tuck: [
    [0.55, 0.85],
    [1.7, 0.88],
    [2.7, 0.86],
    [3.7, 0.845],
    [4.7, 0.86],
    [5.7, 0.9],
    [6.1, 0.88],
  ],
  glass: [
    [2.68, 1.62],
    [3.32, 2.13],
    [4.4, 2.145],
    [5.2, 2.1],
    [5.56, 1.9],
    [4.72, 1.72],
    [3.6, 1.635],
  ],
  bPillar: 3.72,
  doors: [2.26, 3.72, 5.02],
  handles: [
    [3.06, 1.5],
    [4.3, 1.53],
  ],
  mirror: { x: 2.54, y: 1.575 },
  lampY: [1.13, 1.2],
  lampX: 0.78,
  tailY: [1.26, 1.46],
  intake: { y: [0.4, 0.625], z: [0.66, 2.04] },
  vent: { y: [0.44, 0.8], w: 0.32 },
  gill: [1.86, 1.25],
};

const SPECS: Record<BodyStyle, Spec> = { sedan: SEDAN, suv: SUV };

/* ── camera ───────────────────────────────────────────────────────────── */

interface Cam {
  /** Degrees away from a pure side elevation. */
  yaw: number;
  /** Camera height, as a fraction of the beltline. */
  eye: number;
  /** Distance to the car's centre, in W. */
  dist: number;
  persp: boolean;
  /** Screen y the tyres touch. */
  baseY: number;
  padX: number;
  padTop: number;
}

const CAMS: Record<View, Cam> = {
  'front-3q': { yaw: 32, eye: 0.94, dist: 26, persp: true, baseY: 350, padX: 44, padTop: 26 },
  side: { yaw: 0, eye: 0, dist: 26, persp: false, baseY: 356, padX: 38, padTop: 24 },
};

type Proj = (X: number, Y: number, Z?: number) => Pt;

function makeProjector(spec: Spec, cam: Cam): Proj {
  const a = (cam.yaw * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const hx = spec.L / 2;
  const hz = spec.width / 2;
  const eye = cam.eye * spec.belt;
  const raw = (X: number, Y: number, Z: number): Pt => {
    const u = X - hx;
    const w = Z - hz;
    const depth = cam.persp ? cam.dist + u * sa + w * ca : cam.dist;
    return [(u * ca - w * sa) / depth, (eye - Y) / depth];
  };

  /* Fit the car's bounding box into the frame, so the two views arrive at
     the same on-screen size without a hand-tuned scale per camera. */
  const probes: Pt[] = [];
  for (const X of [0, spec.L]) {
    for (const Y of [0, spec.roof]) {
      for (const Z of cam.persp ? [0, spec.width] : [0]) probes.push(raw(X, Y, Z));
    }
  }
  const xs = probes.map((p) => p[0]);
  const ys = probes.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const s = Math.min((VIEW_W - 2 * cam.padX) / (x1 - x0), (cam.baseY - cam.padTop) / (y1 - y0));
  const ox = (VIEW_W - (x1 - x0) * s) / 2 - x0 * s;
  const oy = cam.baseY - y1 * s;
  return (X, Y, Z = 0) => {
    const r = raw(X, Y, Z);
    return [r[0] * s + ox, r[1] * s + oy];
  };
}

/* ── geometry ─────────────────────────────────────────────────────────── */

/** Half wheel arch, traced right → over the top → left. */
function archPts(cx: number, spec: Spec, grow = 0, n = 14): Pt[] | [number, number][] {
  const rx = spec.archRX + grow;
  const ry = spec.archRY + grow;
  const t0 = Math.asin(Math.max(-1, (spec.rockerY - 0.02 - spec.hubY) / ry));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = t0 + ((Math.PI - 2 * t0) * i) / n;
    return [cx + rx * Math.cos(t), spec.hubY + ry * Math.sin(t)] as [number, number];
  });
}

function describe(body: BodyStyle, paint: PaintOption, wheel: WheelOption, view: View): string {
  return `Vela ${body === 'suv' ? 'SUV' : 'sedan'} in ${paint.name} with ${wheel.name}, ${
    view === 'side' ? 'side profile' : 'front three-quarter view'
  }`;
}

/* ── component ────────────────────────────────────────────────────────── */

export default function CarRenderA({
  body,
  paint,
  wheel,
  view = 'front-3q',
  ground = true,
  className,
  label,
}: CarRenderAProps): ReactElement {
  const uid = `a${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const spec = SPECS[body] ?? SEDAN;
  const q3 = view === 'front-3q';
  const cam = CAMS[view];
  const p = makeProjector(spec, cam);

  /* Wheel size only moves the sidewall a little, exactly as it does on a real
     car — the rolling diameter barely changes between 18" and 22". */
  const R = (0.46 * tyreRadius(wheel.size)) / tyreRadius(19);
  const W = spec.width;

  const to = (pts: [number, number][], z = 0): Pt[] => pts.map(([x, y]) => p(x, y, z));
  const to3 = (pts: P3[]): Pt[] => pts.map(([x, y, z]) => p(x, y, z));

  const shoulderF = lane(spec.shoulder);
  const beltF = lane(spec.beltLine);
  const tuckF = lane(spec.tuck);
  const rockerF = lane([
    [spec.axleF, spec.rockerY + 0.005],
    [(spec.axleF + spec.axleR) / 2, spec.rockerY - 0.008],
    [spec.axleR, spec.rockerY + 0.005],
  ]);
  const topF = lane(
    spec.upper.filter((q, i, arr) => i > 0 && i < arr.length - 4 && q[0] > arr[i - 1][0]).map(([x, y]) => [x, y])
  );

  /* ── silhouette ─────────────────────────────────────────────────────── */

  const loop: Pt[] = [
    ...to3(spec.upper),
    ...to3(spec.rearLower),
    ...to(archPts(spec.axleR, spec) as [number, number][]),
    ...to3(spec.rocker),
    ...to(archPts(spec.axleF, spec) as [number, number][]),
    ...to3(spec.frontLower),
  ];
  const outline = curve(loop, true);

  const archPocket = (cx: number): string =>
    `${curve(to(archPts(cx, spec, -0.004) as [number, number][]))} Z`;

  /* ── tonal bands: every one of them a sampled curve off the body ────── */

  const N = 34;
  const nose = q3 ? 0.42 : 0.16;
  const tail = spec.L - 0.14;

  const band = (
    top: (x: number) => number,
    bot: (x: number) => number,
    x0: number,
    x1: number,
    z = 0
  ): string => {
    const xs = range(N, x0, x1);
    return poly([...xs.map((x) => p(x, top(x), z)), ...xs.reverse().map((x) => p(x, bot(x), z))]);
  };
  const ridge = (f: (x: number) => number, x0: number, x1: number, z = 0): string =>
    curve(range(N, x0, x1).map((x) => p(x, f(x), z)));

  const off = (f: (x: number) => number, d: number) => (x: number) => f(x) + d;
  /** Ceiling for the upper flank: the glass sill over the cabin, the top of
      the body everywhere else — which is what curves the sky band. */
  const ceil = (x: number): number =>
    x > spec.beltLine[0][0] && x < spec.beltLine[spec.beltLine.length - 1][0]
      ? beltF(x)
      : Math.min(topF(x) - 0.012, spec.belt + 0.12);

  const skyBand = band(ceil, off(shoulderF, 0.012), nose, tail);
  const horizonBand = band(off(shoulderF, 0.002), off(shoulderF, -0.19), nose, tail);
  const groundBand = band(off(tuckF, 0.14), off(rockerF, 0.012), nose + 0.2, tail - 0.2);
  const sillBand = band(off(rockerF, 0.085), off(rockerF, -0.02), spec.axleF - 0.1, spec.axleR + 0.1);
  const shoulderRidge = ridge(shoulderF, nose, tail);
  const bounceRidge = ridge(off(rockerF, 0.05), spec.axleF - 0.2, spec.axleR + 0.2);
  const beltRidge = ridge(off(beltF, -0.008), spec.beltLine[0][0], spec.beltLine[spec.beltLine.length - 1][0]);
  const tuckRidge = ridge(tuckF, nose + 0.5, tail - 0.5);

  /* ── openings, cuts and jewellery ───────────────────────────────────── */

  const doorCuts = spec.doors.map((x) => {
    const yTop = x < spec.beltLine[0][0] + 0.1 ? topF(x) - 0.01 : beltF(x) + 0.02;
    return curve([
      p(x + 0.03, rockerF(x) + 0.008),
      p(x + 0.005, (rockerF(x) + yTop) / 2),
      p(x - 0.01, yTop),
    ]);
  });
  const hoodCut = curve([
    p(spec.upper[9][0] - 0.04, spec.upper[9][1] - 0.01),
    p(spec.upper[9][0] + 0.02, shoulderF(spec.upper[9][0]) + 0.05),
    p(spec.upper[9][0] + 0.06, shoulderF(spec.upper[9][0]) - 0.06),
  ]);
  const deckCut = curve([
    p(spec.doors[2] + 1.0, beltF(spec.doors[2] + 1.0) + 0.03),
    p(spec.doors[2] + 1.05, shoulderF(spec.doors[2] + 1.05)),
    p(spec.doors[2] + 1.12, tuckF(spec.doors[2] + 1.12) + 0.1),
  ]);

  const bumperCut = (x0: number, yTop: number, yBot: number, lean: number): string =>
    curve([p(x0, yTop), p(x0 + lean * 0.55, (yTop + yBot) / 2), p(x0 + lean, yBot)]);
  const noseCut = bumperCut(spec.frontLower[0][0] + 0.12, shoulderF(0.5) + 0.03, spec.rockerY + 0.02, -0.1);
  const tailCut = bumperCut(spec.L - 0.62, shoulderF(spec.L - 0.62) + 0.02, spec.rockerY + 0.06, 0.12);
  const diffuser = band(
    () => spec.rockerY + 0.02,
    () => spec.rockerY - 0.06,
    spec.L - 0.62,
    spec.L - 0.12
  );

  const handles = spec.handles.map(([x, y]) =>
    curve(
      [
        p(x - 0.16, y),
        p(x + 0.16, y + 0.004),
        p(x + 0.17, y - 0.022),
        p(x - 0.15, y - 0.028),
      ],
      true
    )
  );

  const glassLoop = curve(to(spec.glass, q3 ? 0.16 : 0), true);
  const bPillarPath = poly([
    p(spec.bPillar - 0.035, spec.glass[2][1] + 0.02, q3 ? 0.16 : 0),
    p(spec.bPillar + 0.035, spec.glass[2][1] + 0.02, q3 ? 0.16 : 0),
    p(spec.bPillar + 0.045, beltF(spec.bPillar) - 0.02, q3 ? 0.16 : 0),
    p(spec.bPillar - 0.025, beltF(spec.bPillar) - 0.02, q3 ? 0.16 : 0),
  ]);

  /* Head- and tail-lamp signatures as they wrap onto the near flank. */
  const lampSide = curve(
    [
      p(0.06, spec.lampY[1], 0.32),
      p(0.4, spec.lampY[1] + 0.035, 0.18),
      p(spec.lampX, spec.lampY[1] + 0.052, 0.05),
      p(spec.lampX + 0.03, spec.lampY[1] + 0.014),
      p(0.42, spec.lampY[0] + 0.036, 0.18),
      p(0.07, spec.lampY[0], 0.32),
    ],
    true
  );
  const tailSide = curve(
    [
      p(spec.L - 0.82, spec.tailY[0] + 0.028, 0.02),
      p(spec.L - 0.3, spec.tailY[0] + 0.062, 0.2),
      p(spec.L - 0.03, spec.tailY[0] + 0.045, 0.3),
      p(spec.L - 0.03, spec.tailY[0] - 0.005, 0.3),
      p(spec.L - 0.32, spec.tailY[0] + 0.012, 0.2),
      p(spec.L - 0.82, spec.tailY[0] - 0.012, 0.02),
    ],
    true
  );
  const gill = curve(
    [
      p(spec.gill[0], spec.gill[1]),
      p(spec.gill[0] + 0.3, spec.gill[1] - 0.01),
      p(spec.gill[0] + 0.3, spec.gill[1] - 0.075),
      p(spec.gill[0], spec.gill[1] - 0.055),
    ],
    true
  );

  /* ── the far side: hood shell and front fascia ──────────────────────── */

  const crownZ = lane(spec.crown);
  const noseTop = spec.upper[5];
  const eyeY = CAMS[view].eye * spec.belt;
  const shellTo = (() => {
    let x = spec.upper[3][0];
    for (let i = 0; i < 60; i += 1) {
      const nx = spec.upper[3][0] + ((spec.upper[9][0] - spec.upper[3][0]) * i) / 59;
      if (topF(nx) > eyeY - 0.015) break;
      x = nx;
    }
    return x;
  })();
  const nearZf = lane(spec.upper.map(([a, , c]) => [a, c]));
  const shellXs = range(18, spec.upper[3][0], shellTo);
  const taper = (i: number) => {
    const t = i / (shellXs.length - 1);
    return t < 0.62 ? 1 : Math.max(0, 1 - (t - 0.62) / 0.38) ** 0.8;
  };
  const shellNear = shellXs.map((x) => p(x, topF(x), nearZf(x)));
  const shellFar = shellXs
    .map((x, i) => p(x, topF(x), nearZf(x) + (crownZ(x) - nearZf(x)) * taper(i)))
    .reverse();
  const shell = `${curve(shellNear)} ${curve(shellFar).replace('M', 'L')} Z`;
  const hoodCrest = curve(
    shellXs.map((x, i) => p(x, topF(x) + 0.004, nearZf(x) + (crownZ(x) - nearZf(x)) * taper(i) * 0.5))
  );

  /* The fascia: the nose profile swept across the car, bulging forward at the
     centreline so the front reads wide and the corners round off. */
  const noseProfile = spec.upper.slice(0, 6);
  const yLo = noseProfile[0][1];
  const yHi = noseProfile[noseProfile.length - 1][1];
  const zNear = (y: number) => {
    const t = Math.min(1, Math.max(0, (y - yLo) / (yHi - yLo)));
    return 0.3 - 0.1 * t;
  };
  const zFar = (y: number) => W - zNear(y) - 0.06 * (1 - Math.abs(0.5 - (y - yLo) / (yHi - yLo)) * 2);
  const bulgeAt = (y: number, z: number) => {
    const t = (z - zNear(y)) / (zFar(y) - zNear(y));
    return spec.bulge * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
  };
  const across = (x: number, y: number, n = 11): Pt[] =>
    range(n, zNear(y), zFar(y)).map((z) => p(x - bulgeAt(y, z), y, z));
  const faceNear = noseProfile.map(([x, y]) => p(x, y, zNear(y)));
  const faceFar = [...noseProfile].reverse().map(([x, y]) => p(x, y, zFar(y)));
  const face = curve(
    [
      ...faceNear,
      ...across(noseTop[0], yHi).slice(1, -1),
      ...faceFar,
      ...[...across(noseProfile[0][0], yLo)].reverse().slice(1, -1),
    ],
    true
  );
  const midY = (yHi + yLo) / 2;
  const wrapA = p(0.06 - bulgeAt(midY, zNear(midY)), midY, zNear(midY));
  const wrapB = p(0.06 - bulgeAt(midY, zFar(midY)), midY, zFar(midY));
  const faceLip = curve(across(noseProfile[0][0] + 0.02, yLo + 0.05, 13));
  const faceTop = curve(across(noseTop[0] - 0.01, yHi - 0.012, 13));
  const faceEdge = curve(noseProfile.map(([x, y]) => p(x + 0.005, y, zNear(y) + 0.02)));
  const lampCore = (z0: number, z1: number): string => {
    const yM = (spec.lampY[0] + spec.lampY[1]) / 2;
    const zs = range(4, z0, z1);
    return curve(
      [
        ...zs.map((z) => p(0.045 - bulgeAt(spec.lampY[1], z), yM + 0.022, z)),
        ...[...zs].reverse().map((z) => p(0.055 - bulgeAt(spec.lampY[0], z), yM - 0.02, z)),
      ],
      true
    );
  };
  const faceSplit = curve(across(0.055, (spec.lampY[0] + spec.intake.y[1]) / 2 + 0.02, 13));

  const lampBlade = (z0: number, z1: number): string => {
    const zs = range(7, z0, z1);
    const yT = spec.lampY[1];
    const yB = spec.lampY[0];
    return curve(
      [
        ...zs.map((z) => p(0.045 - bulgeAt(yT, z), yT, z)),
        ...[...zs].reverse().map((z) => p(0.06 - bulgeAt(yB, z), yB, z)),
      ],
      true
    );
  };
  const lampNear = lampBlade(zNear(spec.lampY[1]) + 0.03, W * 0.38);
  const lampFar = lampBlade(W - zNear(spec.lampY[1]) - 0.03, W * 0.62);
  const lampCoreNear = lampCore(zNear(spec.lampY[1]) + 0.06, W * 0.2);
  const lampCoreFar = lampCore(W - zNear(spec.lampY[1]) - 0.06, W * 0.8);

  const intake = (() => {
    const [y0, y1] = spec.intake.y;
    const zs = range(9, spec.intake.z[0], spec.intake.z[1]);
    return curve(
      [
        ...zs.map((z) => p(0.055 - bulgeAt(y1, z) * 0.9, y1, z)),
        ...[...zs].reverse().map((z) => p(0.085 - bulgeAt(y0, z) * 0.9, y0, z)),
      ],
      true
    );
  })();
  const curtain = (side: 'near' | 'far'): string => {
    const [y0, y1] = spec.vent.y;
    const z0 = side === 'near' ? zNear(y1) + 0.05 : W - zNear(y1) - 0.05 - spec.vent.w;
    const zs = range(4, z0, z0 + spec.vent.w);
    return curve(
      [
        ...zs.map((z) => p(0.05 - bulgeAt(y1, z) * 0.9, y1, z)),
        ...[...zs].reverse().map((z) => p(0.08 - bulgeAt(y0, z) * 0.9, y0, z)),
      ],
      true
    );
  };

  /* Windscreen and the near mirror. */
  const wsBase = spec.upper[9];
  const wsTop = spec.upper[12];
  const windscreen = poly([
    p(wsBase[0], wsBase[1], wsBase[2]),
    p(wsTop[0], wsTop[1], wsTop[2]),
    p(wsTop[0], wsTop[1], crownZ(wsTop[0])),
    p(wsBase[0], wsBase[1], crownZ(wsBase[0])),
  ]);
  const farPillar = poly(
    [p(wsBase[0], wsBase[1], crownZ(wsBase[0])), p(wsTop[0], wsTop[1], crownZ(wsTop[0]))],
    false
  );
  const wsSweep = poly([
    p(wsBase[0] + 0.12, wsBase[1] + 0.04, wsBase[2] + 0.1),
    p(wsTop[0] - 0.04, wsTop[1] - 0.02, wsTop[2] + 0.12),
    p(wsTop[0] - 0.02, wsTop[1] - 0.03, crownZ(wsTop[0]) * 0.72),
    p(wsBase[0] + 0.2, wsBase[1] + 0.02, crownZ(wsBase[0]) * 0.55),
  ]);
  const wiper = curve([
    p(wsBase[0] + 0.06, wsBase[1] + 0.03, 0.5),
    p(wsBase[0] + 0.2, wsBase[1] + 0.08, 1.0),
    p(wsBase[0] + 0.28, wsBase[1] + 0.1, 1.5),
  ]);
  const roofRail = curve([
    p(wsTop[0], wsTop[1], wsTop[2]),
    p(spec.upper[14][0], spec.upper[14][1], spec.upper[14][2]),
    p(spec.upper[16][0], spec.upper[16][1], spec.upper[16][2]),
  ]);

  const mirrorAt = (z: number, out: number): string =>
    curve(
      [
        p(spec.mirror.x, spec.mirror.y, z),
        p(spec.mirror.x + 0.1, spec.mirror.y + 0.03, z + out * 0.6),
        p(spec.mirror.x + 0.28, spec.mirror.y + 0.02, z + out),
        p(spec.mirror.x + 0.3, spec.mirror.y - 0.11, z + out),
        p(spec.mirror.x + 0.12, spec.mirror.y - 0.14, z + out * 0.5),
        p(spec.mirror.x + 0.02, spec.mirror.y - 0.09, z),
      ],
      true
    );

  /* ── wheels, contact, floor ─────────────────────────────────────────── */

  const wheelZ = 0.0;
  const mk = (X: number, Z: number, shade?: number) => {
    const c = p(X, R, Z);
    const a1 = p(X + R, R, Z);
    const b1 = p(X, 0, Z);
    return { cx: c[0], cy: c[1], ax: a1[0] - c[0], ay: a1[1] - c[1], by: b1[1] - c[1], shade };
  };
  const wheels = [
    ...(q3 ? [mk(spec.axleF, W - 0.3, 0.68)] : []),
    mk(spec.axleF, wheelZ),
    mk(spec.axleR, wheelZ, q3 ? 0.12 : 0.06),
  ];
  const nearWheels = wheels.slice(q3 ? 1 : 0);

  const cFront = p(spec.axleF, 0, wheelZ);
  const cRear = p(spec.axleR, 0, wheelZ);
  const angle = (Math.atan2(cRear[1] - cFront[1], cRear[0] - cFront[0]) * 180) / Math.PI;
  const flip = `translate(${cFront[0].toFixed(1)} ${cFront[1].toFixed(1)}) rotate(${angle.toFixed(2)})`;

  /* Underbody: one dark mass that hugs the real silhouette and dissolves at
     the floor, so no rectangle ever appears under the car. */
  const underTop: Pt[] = [
    p(spec.axleR + 0.62, rockerF(spec.axleR) - 0.02, 0.06),
    p(spec.axleR, spec.hubY - 0.02, 0.06),
    p((spec.axleF + spec.axleR) / 2, rockerF(3) - 0.01, 0.06),
    p(spec.axleF, spec.hubY - 0.02, 0.06),
    p(spec.axleF - 0.55, rockerF(spec.axleF) - 0.05, 0.06),
    p(0.2, spec.upper[0][1] - 0.02, 0.3),
  ];
  const under = curve(
    [
      ...underTop,
      p(0.34, 0.06, q3 ? W * 0.6 : 0.3),
      p(spec.axleF, 0.02, q3 ? W * 0.55 : 0.2),
      p((spec.axleF + spec.axleR) / 2, 0.0, q3 ? W * 0.4 : 0.2),
      p(spec.axleR, 0.02, 0.2),
      p(spec.axleR + 0.5, 0.1, 0.1),
    ],
    true
  );

  /* Gradient axes: square to the floor in screen space, so they lean with
     the perspective instead of running dead vertical. */
  const axis = (X: number, yTop: number, yBot: number, Z = 0): [Pt, Pt] => [p(X, yTop, Z), p(X, yBot, Z)];
  const mid = (spec.axleF + spec.axleR) / 2;
  const [fa, fb] = axis(mid, spec.belt + 0.18, -0.02);
  const [ta, tb] = axis(1.1, spec.roof * 0.72, spec.rockerY, W * 0.5);
  const [ga, gb] = axis(spec.bPillar, spec.roof + 0.06, spec.belt - 0.05, q3 ? 0.16 : 0);
  const [ca2, cb2] = axis(0.05, yHi + 0.16, yLo - 0.1, W * 0.5);
  const [ua, ub] = axis(mid, spec.rockerY, -0.06);
  const x0 = p(0, 0.6, q3 ? W : 0)[0];
  const x1 = p(spec.L, 0.6, 0)[0];

  const sheenLo = mix(paint.sheen, paint.hex, 0.45);
  const deep = mix(paint.shade, '#000000', 0.35);

  return (
    <svg
      className={className ? `car-render car-render-a ${className}` : 'car-render car-render-a'}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label ?? describe(body, paint, wheel, view)}
    >
      <defs>
        {/* Flank: sky at the shoulder, the studio floor low down, a lick of
            bounce off the tile just above the sill. */}
        <linearGradient id={`${uid}-flank`} gradientUnits="userSpaceOnUse" x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]}>
          <stop offset="0" stopColor={mix(paint.sheen, '#ffffff', 0.25)} />
          <stop offset="0.1" stopColor={paint.sheen} />
          <stop offset="0.26" stopColor={mix(paint.sheen, paint.hex, 0.6)} />
          <stop offset="0.4" stopColor={paint.hex} />
          <stop offset="0.6" stopColor={mix(paint.hex, paint.shade, 0.55)} />
          <stop offset="0.79" stopColor={paint.shade} />
          <stop offset="0.9" stopColor={deep} />
          <stop offset="0.965" stopColor={mix(paint.shade, paint.sheen, 0.42)} />
          <stop offset="1" stopColor={mix(deep, '#000000', 0.4)} />
        </linearGradient>
        {/* Upward-facing panels see the softbox: light, and soft with it. */}
        <linearGradient id={`${uid}-top`} gradientUnits="userSpaceOnUse" x1={ta[0]} y1={ta[1]} x2={tb[0]} y2={tb[1]}>
          <stop offset="0" stopColor={mix(paint.sheen, '#ffffff', 0.45)} />
          <stop offset="0.34" stopColor={paint.sheen} />
          <stop offset="0.66" stopColor={mix(paint.hex, paint.sheen, 0.35)} />
          <stop offset="1" stopColor={mix(paint.hex, paint.shade, 0.3)} />
        </linearGradient>
        <linearGradient
          id={`${uid}-face`}
          gradientUnits="userSpaceOnUse"
          x1={ca2[0]}
          y1={ca2[1]}
          x2={cb2[0]}
          y2={cb2[1]}
        >
          <stop offset="0" stopColor={mix(paint.hex, paint.sheen, 0.42)} />
          <stop offset="0.14" stopColor={mix(paint.hex, paint.sheen, 0.14)} />
          <stop offset="0.38" stopColor={paint.hex} />
          <stop offset="0.7" stopColor={mix(paint.hex, paint.shade, 0.42)} />
          <stop offset="0.9" stopColor={paint.shade} />
          <stop offset="0.97" stopColor={mix(paint.shade, deep, 0.55)} />
          <stop offset="1" stopColor={mix(paint.shade, paint.sheen, 0.4)} />
        </linearGradient>

        <linearGradient
          id={`${uid}-faceWrap`}
          gradientUnits="userSpaceOnUse"
          x1={wrapA[0]}
          y1={wrapA[1]}
          x2={wrapB[0]}
          y2={wrapB[1]}
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.14" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="0.46" stopColor="#000000" stopOpacity="0.03" />
          <stop offset="0.8" stopColor="#000000" stopOpacity="0.09" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.17" />
        </linearGradient>

        {/* Environment bands. They fade along the car so nothing terminates
            in a hard edge. */}
        <linearGradient id={`${uid}-sky`} gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={x1} y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.46" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="0.78" stopColor="#ffffff" stopOpacity="0.36" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-skyFade`} gradientUnits="userSpaceOnUse" x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-horizon`} gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={x1} y2="0">
          <stop offset="0" stopColor={deep} stopOpacity="0.06" />
          <stop offset="0.2" stopColor={deep} stopOpacity="0.62" />
          <stop offset="0.6" stopColor={deep} stopOpacity="0.44" />
          <stop offset="0.9" stopColor={deep} stopOpacity="0.52" />
          <stop offset="1" stopColor={deep} stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={`${uid}-floorRef`} gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={x1} y2="0">
          <stop offset="0" stopColor={deep} stopOpacity="0.1" />
          <stop offset="0.3" stopColor={deep} stopOpacity="0.46" />
          <stop offset="0.75" stopColor={deep} stopOpacity="0.4" />
          <stop offset="1" stopColor={deep} stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={`${uid}-bounce`} gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={x1} y2="0">
          <stop offset="0" stopColor={sheenLo} stopOpacity="0" />
          <stop offset="0.3" stopColor={sheenLo} stopOpacity="0.5" />
          <stop offset="0.72" stopColor={sheenLo} stopOpacity="0.34" />
          <stop offset="1" stopColor={sheenLo} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-crease`} gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={x1} y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.1" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="0.24" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.48" />
          <stop offset="0.82" stopColor="#ffffff" stopOpacity="0.76" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-sill`} gradientUnits="userSpaceOnUse" x1={ua[0]} y1={ua[1]} x2={ub[0]} y2={ub[1]}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.1" />
          <stop offset="0.55" stopColor="#000000" stopOpacity="0.4" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.62" />
        </linearGradient>

        {/* A soft local highlight — the studio's key light rolling over a
            crown. Placed by transform, so it stays elliptical. */}
        <radialGradient id={`${uid}-spot`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-pool`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000000" stopOpacity="0.34" />
          <stop offset="0.6" stopColor="#000000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* Glass has its own colour — never the paint. */}
        <linearGradient id={`${uid}-glass`} gradientUnits="userSpaceOnUse" x1={ga[0]} y1={ga[1]} x2={gb[0]} y2={gb[1]}>
          <stop offset="0" stopColor="#5d6b78" />
          <stop offset="0.24" stopColor="#333d47" />
          <stop offset="0.62" stopColor="#1b222a" />
          <stop offset="0.9" stopColor="#11161c" />
          <stop offset="1" stopColor="#242c35" />
        </linearGradient>
        <linearGradient id={`${uid}-ws`} gradientUnits="userSpaceOnUse" x1={ga[0]} y1={ga[1]} x2={gb[0]} y2={gb[1]}>
          <stop offset="0" stopColor="#97a3b0" />
          <stop offset="0.28" stopColor="#5d6976" />
          <stop offset="0.62" stopColor="#333c46" />
          <stop offset="0.88" stopColor="#222a33" />
          <stop offset="1" stopColor="#2c353f" />
        </linearGradient>

        <linearGradient id={`${uid}-led`} gradientUnits="userSpaceOnUse" x1={x0} y1="0" x2={x0 + 320} y2="0">
          <stop offset="0" stopColor="#c8d6ee" />
          <stop offset="0.3" stopColor="#ffffff" />
          <stop offset="0.62" stopColor="#eef4ff" />
          <stop offset="1" stopColor="#93a9c9" />
        </linearGradient>
        <linearGradient id={`${uid}-tail`} gradientUnits="userSpaceOnUse" x1={x1 - 190} y1="0" x2={x1} y2="0">
          <stop offset="0" stopColor="#790d13" />
          <stop offset="0.4" stopColor="#c9231d" />
          <stop offset="1" stopColor="#f0604a" />
        </linearGradient>

        <linearGradient id={`${uid}-under`} gradientUnits="userSpaceOnUse" x1={ua[0]} y1={ua[1]} x2={ub[0]} y2={ub[1]}>
          <stop offset="0" stopColor="#05070a" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#070a0e" stopOpacity="0.86" />
          <stop offset="0.82" stopColor="#0c1116" stopOpacity="0.42" />
          <stop offset="1" stopColor="#141a21" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-pocket`} gradientUnits="userSpaceOnUse" x1={ua[0]} y1={ua[1] - 110} x2={ua[0]} y2={ua[1] + 20}>
          <stop offset="0" stopColor="#232931" />
          <stop offset="0.5" stopColor="#0e1218" />
          <stop offset="1" stopColor="#04060a" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0a0d11" stopOpacity="0.38" />
          <stop offset="0.55" stopColor="#0a0d11" stopOpacity="0.12" />
          <stop offset="1" stopColor="#0a0d11" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-patch`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#04060a" stopOpacity="0.72" />
          <stop offset="0.45" stopColor="#04060a" stopOpacity="0.4" />
          <stop offset="1" stopColor="#04060a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <RimDefs uid={uid} />

        <filter id={`${uid}-b18`} filterUnits="userSpaceOnUse" x="-160" y="-160" width="1520" height="740">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id={`${uid}-b9`} filterUnits="userSpaceOnUse" x="-160" y="-160" width="1520" height="740">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={`${uid}-b4`} filterUnits="userSpaceOnUse" x="-160" y="-160" width="1520" height="740">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id={`${uid}-b2`} filterUnits="userSpaceOnUse" x="-160" y="-160" width="1520" height="740">
          <feGaussianBlur stdDeviation="1.7" />
        </filter>

        <clipPath id={`${uid}-clipBody`}>
          <path d={outline} />
        </clipPath>
        <clipPath id={`${uid}-clipFace`}>
          <path d={face} />
        </clipPath>
        <clipPath id={`${uid}-clipGlass`}>
          <path d={glassLoop} />
        </clipPath>
        <mask id={`${uid}-maskFloor`}>
          <g transform={flip}>
            <rect x="-400" y="0" width="2000" height="120" fill={`url(#${uid}-fade)`} />
          </g>
        </mask>
      </defs>

      {ground && (
        <g className="car-render__floor" mask={`url(#${uid}-maskFloor)`} opacity="0.085">
          <use
            href={`#${uid}-car`}
            transform={`${flip} scale(1 -1) rotate(${(-angle).toFixed(2)}) translate(${(-cFront[0]).toFixed(1)} ${(
              -cFront[1]
            ).toFixed(1)})`}
          />
        </g>
      )}

      {ground && (
        <g className="car-render__shadow">
          {/* Ambient occlusion under the body, tucked inside the bumpers. */}
          <ellipse
            cx={(cFront[0] + cRear[0]) / 2}
            cy={(cFront[1] + cRear[1]) / 2 + 3}
            rx={(cRear[0] - cFront[0]) / 2 + 58}
            ry="15"
            fill={`url(#${uid}-shadow)`}
            filter={`url(#${uid}-b18)`}
            transform={`rotate(${angle.toFixed(2)} ${((cFront[0] + cRear[0]) / 2).toFixed(1)} ${(
              (cFront[1] + cRear[1]) / 2
            ).toFixed(1)})`}
          />
          {/* Tight contact patches: darkest right under the tyre. */}
          {nearWheels.map((w) => (
            <ellipse
              key={`c${w.cx.toFixed(1)}`}
              cx={w.cx}
              cy={w.cy + w.by + 1}
              rx={Math.abs(w.ax) * 1.05}
              ry="7.5"
              fill={`url(#${uid}-patch)`}
              filter={`url(#${uid}-b4)`}
              transform={`rotate(${angle.toFixed(2)} ${w.cx.toFixed(1)} ${(w.cy + w.by).toFixed(1)})`}
            />
          ))}
        </g>
      )}

      <g id={`${uid}-car`}>
        {/* Far side first. */}
        {q3 &&
          wheels.slice(0, 1).map((w) => (
            <Wheel
              key={`f${w.cx.toFixed(1)}`}
              uid={uid}
              style={wheel.style}
              size={wheel.size}
              cx={w.cx}
              cy={w.cy}
              ax={w.ax}
              ay={w.ay}
              by={w.by}
              shade={w.shade}
            />
          ))}

        <path d={under} fill={`url(#${uid}-under)`} filter={`url(#${uid}-b4)`} />
        <path d={archPocket(spec.axleF)} fill={`url(#${uid}-pocket)`} />
        <path d={archPocket(spec.axleR)} fill={`url(#${uid}-pocket)`} />

        {nearWheels.map((w) => (
          <Wheel
            key={`n${w.cx.toFixed(1)}`}
            uid={uid}
            style={wheel.style}
            size={wheel.size}
            cx={w.cx}
            cy={w.cy}
            ax={w.ax}
            ay={w.ay}
            by={w.by}
            shade={w.shade}
          />
        ))}

        {/* Hood, seen from a camera just under the beltline. */}
        {q3 && (
          <>
            <path d={shell} fill={`url(#${uid}-top)`} />
            <path d={shell} fill={`url(#${uid}-skyFade)`} opacity="0.22" />
          </>
        )}

        {/* The near flank and everything painted on it. */}
        <path d={outline} fill={`url(#${uid}-flank)`} />
        <g clipPath={`url(#${uid}-clipBody)`}>
          {/* 3 · the flank below the character line reflects the floor */}
          <path d={groundBand} fill={`url(#${uid}-floorRef)`} filter={`url(#${uid}-b18)`} />
          <path d={sillBand} fill={`url(#${uid}-sill)`} filter={`url(#${uid}-b9)`} />
          {/* 1 · upper surfaces reflect the sky */}
          <g opacity="0.9">
            <path d={skyBand} fill={`url(#${uid}-sky)`} filter={`url(#${uid}-b9)`} />
          </g>
          {/* 2 · the horizon: dark immediately under a thin bright edge */}
          <path d={horizonBand} fill={`url(#${uid}-horizon)`} filter={`url(#${uid}-b4)`} />
          <path
            d={shoulderRidge}
            fill="none"
            stroke={`url(#${uid}-crease)`}
            strokeWidth="6"
            opacity="0.45"
            filter={`url(#${uid}-b4)`}
          />
          <path d={shoulderRidge} fill="none" stroke={`url(#${uid}-crease)`} strokeWidth="1.3" />
          <path
            d={shoulderRidge}
            fill="none"
            stroke="#04060a"
            strokeOpacity="0.45"
            strokeWidth="2.6"
            transform="translate(0 3)"
            filter={`url(#${uid}-b2)`}
          />
          {/* Key light rolling over the fender crown and the rear haunch. */}
          <ellipse
            cx={p(spec.axleF + 0.1, shoulderF(spec.axleF) + 0.1)[0]}
            cy={p(spec.axleF + 0.1, shoulderF(spec.axleF) + 0.1)[1]}
            rx={Math.abs(p(1.1, 0)[0] - p(0, 0)[0])}
            ry={Math.abs(p(0, 0.34)[1] - p(0, 0)[1])}
            fill={`url(#${uid}-spot)`}
            opacity="0.7"
            transform={`rotate(${(angle - 5).toFixed(2)} ${p(spec.axleF + 0.1, shoulderF(spec.axleF) + 0.1)[0].toFixed(
              1
            )} ${p(spec.axleF + 0.1, shoulderF(spec.axleF) + 0.1)[1].toFixed(1)})`}
          />
          <ellipse
            cx={p(spec.axleR, shoulderF(spec.axleR) + 0.12)[0]}
            cy={p(spec.axleR, shoulderF(spec.axleR) + 0.12)[1]}
            rx={Math.abs(p(1.0, 0)[0] - p(0, 0)[0])}
            ry={Math.abs(p(0, 0.3)[1] - p(0, 0)[1])}
            fill={`url(#${uid}-spot)`}
            opacity="0.55"
            transform={`rotate(${(angle - 7).toFixed(2)} ${p(spec.axleR, shoulderF(spec.axleR) + 0.12)[0].toFixed(1)} ${p(
              spec.axleR,
              shoulderF(spec.axleR) + 0.12
            )[1].toFixed(1)})`}
          />
          {/* Shadow pooling in the door hollow. */}
          <ellipse
            cx={p(mid, tuckF(mid) + 0.02)[0]}
            cy={p(mid, tuckF(mid) + 0.02)[1]}
            rx={Math.abs(p(1.7, 0)[0] - p(0, 0)[0])}
            ry={Math.abs(p(0, 0.3)[1] - p(0, 0)[1])}
            fill={`url(#${uid}-pool)`}
            opacity="0.42"
            transform={`rotate(${angle.toFixed(2)} ${p(mid, tuckF(mid))[0].toFixed(1)} ${p(mid, tuckF(mid))[1].toFixed(
              1
            )})`}
          />
          <path
            d={tuckRidge}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.2"
            strokeWidth="2.2"
            filter={`url(#${uid}-b2)`}
          />
          {/* 4 · bounce off the studio floor along the sill */}
          <path
            d={bounceRidge}
            fill="none"
            stroke={`url(#${uid}-bounce)`}
            strokeWidth="5"
            filter={`url(#${uid}-b4)`}
          />
          <path d={bounceRidge} fill="none" stroke={`url(#${uid}-bounce)`} strokeWidth="1.4" opacity="0.8" />
          {/* 5 · arches are the darkest thing on the body */}
          {[spec.axleF, spec.axleR].map((cx) => (
            <path
              key={`as${cx}`}
              d={curve(to(archPts(cx, spec, 0.085) as [number, number][]))}
              fill="none"
              stroke="#04060a"
              strokeOpacity="0.34"
              strokeWidth="9"
              filter={`url(#${uid}-b4)`}
            />
          ))}
          {[spec.axleF, spec.axleR].map((cx) => (
            <path
              key={`al${cx}`}
              d={curve(to(archPts(cx, spec, 0.008) as [number, number][]))}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.32"
              strokeWidth="1.4"
            />
          ))}
          {/* Panel gaps, as hairlines. */}
          <g fill="none" stroke="#04060a" strokeOpacity="0.34" strokeWidth="1.1" strokeLinecap="round">
            {doorCuts.map((d) => (
              <path key={d} d={d} />
            ))}
            <path d={hoodCut} strokeOpacity="0.2" />
            <path d={deckCut} strokeOpacity="0.2" />
            <path d={noseCut} strokeOpacity="0.26" />
            <path d={tailCut} strokeOpacity="0.26" />
          </g>
          <g fill="none" stroke="#ffffff" strokeOpacity="0.13" strokeWidth="0.9" transform="translate(1.1 0)">
            {doorCuts.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <path d={beltRidge} fill="none" stroke="#c8ced6" strokeOpacity="0.5" strokeWidth="2" />
          <path d={beltRidge} fill="none" stroke="#04060a" strokeOpacity="0.35" strokeWidth="1" transform="translate(0 2)" />
          {handles.map((d) => (
            <g key={d}>
              <path d={d} fill="#ffffff" fillOpacity="0.22" />
              <path d={d} fill="none" stroke="#04060a" strokeOpacity="0.34" strokeWidth="0.9" />
            </g>
          ))}
          <path d={diffuser} fill="#0a0d11" fillOpacity="0.4" filter={`url(#${uid}-b4)`} />
          <path d={gill} fill="#0a0d11" fillOpacity="0.72" />
          <path d={gill} fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="0.8" />
          {/* Lamps, only where they would actually be seen. */}
          <path d={tailSide} fill="#100b0c" />
          <path d={tailSide} fill={`url(#${uid}-tail)`} transform="translate(0 1.4)" opacity="0.95" />
          <path d={tailSide} fill="none" stroke="#08090c" strokeOpacity="0.55" strokeWidth="0.9" />
          {!q3 && (
            <>
              <path d={lampSide} fill="#0b0e12" />
              <path d={lampSide} fill={`url(#${uid}-led)`} transform="translate(0 1.4)" />
              <path d={lampSide} fill="#ffffff" opacity="0.35" filter={`url(#${uid}-b2)`} />
            </>
          )}
          {q3 && (
            <>
              <path d={lampSide} fill="#0b0e12" opacity="0.9" />
              <path d={lampSide} fill={`url(#${uid}-led)`} opacity="0.85" transform="translate(0 1.2)" />
            </>
          )}
        </g>

        {/* Glasshouse. */}
        <path d={glassLoop} fill={`url(#${uid}-glass)`} />
        <g clipPath={`url(#${uid}-clipGlass)`}>
          <path
            d={ridge(off(beltF, 0.28), spec.glass[0][0] - 0.2, spec.glass[4][0] + 0.2, q3 ? 0.16 : 0)}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.13"
            strokeWidth="16"
            filter={`url(#${uid}-b9)`}
          />
          <path d={bPillarPath} fill="#0c0f13" />
        </g>
        <path d={glassLoop} fill="none" stroke="#07090c" strokeOpacity="0.6" strokeWidth="2.2" />

        {q3 && (
          <>
            <path
              d={farPillar}
              fill="none"
              stroke={mix(paint.shade, deep, 0.45)}
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path d={windscreen} fill={`url(#${uid}-ws)`} />
            <g clipPath={`url(#${uid}-clipGlass)`} />
            <path d={wsSweep} fill="#ffffff" opacity="0.26" filter={`url(#${uid}-b9)`} />
            <path d={wiper} fill="none" stroke="#0a0c10" strokeOpacity="0.5" strokeWidth="1.6" />
            <path d={windscreen} fill="none" stroke="#07090c" strokeOpacity="0.55" strokeWidth="2" />
            <path d={roofRail} fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.6" />
            <path d={mirrorAt(W - 0.06, 0.22)} fill={`url(#${uid}-face)`} />
            <path d={mirrorAt(W - 0.06, 0.22)} fill="#04060a" fillOpacity="0.45" />
          </>
        )}

        <path d={mirrorAt(0.04, -0.22)} fill={`url(#${uid}-flank)`} />
        <path d={mirrorAt(0.04, -0.22)} fill="#04060a" fillOpacity="0.22" />
        <path d={mirrorAt(0.04, -0.22)} fill="none" stroke="#04060a" strokeOpacity="0.35" strokeWidth="0.9" />

        {/* Front end — nearest the camera, so it lands last. */}
        {q3 && (
          <>
            <path d={hoodCrest} fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="4" filter={`url(#${uid}-b2)`} />
            <path d={face} fill={`url(#${uid}-face)`} />
            <path d={face} fill={`url(#${uid}-faceWrap)`} />
            <g clipPath={`url(#${uid}-clipFace)`}>
              {/* Shut line where the bonnet drops onto the fascia. */}
              <path d={faceTop} fill="none" stroke="#04060a" strokeOpacity="0.42" strokeWidth="1.4" />
              <path d={faceTop} fill="none" stroke="#04060a" strokeOpacity="0.3" strokeWidth="7" filter={`url(#${uid}-b4)`} transform="translate(0 5)" />
              <path d={faceSplit} fill="none" stroke="#04060a" strokeOpacity="0.22" strokeWidth="1.2" />
              <path
                d={faceSplit}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.16"
                strokeWidth="1.4"
                transform="translate(0 2)"
              />
              <path d={intake} fill="#0b0e12" fillOpacity="0.72" />
              <path d={intake} fill="none" stroke="#ffffff" strokeOpacity="0.13" strokeWidth="1.4" transform="translate(0 -1.6)" />
              <path d={curtain('near')} fill="#0b0e12" fillOpacity="0.5" />
              <path d={curtain('far')} fill="#0b0e12" fillOpacity="0.5" />
              <path d={faceLip} fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="3" filter={`url(#${uid}-b2)`} />
              {[lampFar, lampNear].map((d, i) => (
                <g key={`lamp${i}`} opacity={i === 0 ? 0.86 : 1}>
                  {/* housing, LED blade, then a small warm core */}
                  <path d={d} fill="#0a0d11" transform="translate(0 -2.6)" />
                  <path d={d} fill="#0a0d11" transform="translate(0 2.8)" />
                  <path d={d} fill={`url(#${uid}-led)`} />
                  <path d={d} fill="#ffffff" opacity="0.45" filter={`url(#${uid}-b2)`} />
                </g>
              ))}
              {[lampCoreFar, lampCoreNear].map((d, i) => (
                <g key={`core${i}`} opacity={i === 0 ? 0.7 : 1}>
                  <path d={d} fill="#fff6e2" />
                  <path d={d} fill="#ffe9c0" filter={`url(#${uid}-b4)`} opacity="0.9" />
                </g>
              ))}
              {/* The fascia turns onto the fender along a crisp vertical. */}
              <path
                d={faceEdge}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.26"
                strokeWidth="2.4"
                filter={`url(#${uid}-b2)`}
              />
              <path d={faceEdge} fill="none" stroke="#04060a" strokeOpacity="0.2" strokeWidth="6" filter={`url(#${uid}-b4)`} transform="translate(-7 0)" />
            </g>
            <path d={face} fill="none" stroke="#04060a" strokeOpacity="0.16" strokeWidth="1" />
          </>
        )}
      </g>
    </svg>
  );
}
