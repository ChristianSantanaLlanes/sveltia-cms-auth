import { useId, type ReactElement } from 'react';
import type { BodyStyle, PaintOption, WheelOption } from '@/types';
import { Wheel, RimDefs, rimRatio } from './rims';
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
type Pt = [number, number];
/** A point on the car's near flank: [along the car from the nose, up from the floor]. */
type P2 = [number, number];
type V3 = [number, number, number];

const VIEW_W = 1200;
const VIEW_H = 420;

/* ── Vector maths ─────────────────────────────────────────────────────────*/

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function samples(x0: number, x1: number, n: number): number[] {
  return Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
}

/** Linear interpolation of a profile polyline at x. */
function yAt(pts: P2[], x: number): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i += 1) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
  }
  return pts[pts.length - 1][1];
}

/* ── Path helpers ─────────────────────────────────────────────────────────*/

const fmt = (pt: Pt): string => `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`;

/** Catmull-Rom through every point — the continuous line a body panel has. */
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
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
  }
  return close ? `${d} Z` : d;
}

const poly = (pts: Pt[], close = true): string => `M ${pts.map(fmt).join(' L ')}${close ? ' Z' : ''}`;

/** A closed loop from a top edge and a bottom edge that share an x range. */
function ribbon(top: Pt[], bottom: Pt[]): string {
  return `${curve(top)} ${curve([...bottom].reverse()).replace('M', 'L')} Z`;
}

/* ── The vehicles ─────────────────────────────────────────────────────────
   All dimensions share one unit. The sedan is 4.60 long, 1.42 tall at the
   roof, its beltline at 0.95 and its rocker at 0.30 — the proportions in the
   brief — with a 2.90 wheelbase pushed so the A-pillar lands 1.35 behind the
   nose. The wheel is 0.73 across rather than a full unit, which is what lets
   the arch crown sit under the beltline instead of through the door glass. */

interface Spec {
  L: number;
  W: number;
  axleF: number;
  axleR: number;
  /** Tyre radius at 19in; bigger rims grow it very slightly. */
  R: number;
  archGap: number;
  rockerY: number;
  beltY: number;
  roofY: number;
  bulgeF: number;
  outlineTop: P2[];
  rearLower: P2[];
  rocker: P2[];
  frontLower: P2[];
  shoulder: P2[];
  dlo: P2[];
  wsBase: P2;
  wsTop: P2;
  wsZ: [number, number];
  doors: number[];
  handles: number[];
  hoodFrontX: number;
  deckEndX: number;
  cowl: P2;
  crown: number;
  lamp: { y: [number, number]; inset: number };
  lampSide: P2[];
  intake: { y: [number, number]; inset: number };
  vent: { y: [number, number]; w: number };
  mirror: { x: number; y: number; w: number; h: number; out: number };
  tailLamp: P2[];
  deckCutX: number;
}

const SEDAN: Spec = {
  L: 4.6,
  W: 1.85,
  axleF: 0.9,
  axleR: 3.76,
  R: 0.336,
  archGap: 0.078,
  rockerY: 0.3,
  beltY: 0.95,
  roofY: 1.42,
  bulgeF: 0.14,
  outlineTop: [
    [0.212, 0.298],
    [0.126, 0.398],
    [0.088, 0.514],
    [0.104, 0.622],
    [0.176, 0.694],
    [0.3, 0.752],
    [0.56, 0.8],
    [0.9, 0.842],
    [1.18, 0.882],
    [1.35, 0.918],
    [1.56, 1.022],
    [1.87, 1.21],
    [2.18, 1.362],
    [2.43, 1.414],
    [2.7, 1.424],
    [3.0, 1.406],
    [3.32, 1.336],
    [3.66, 1.216],
    [3.96, 1.124],
    [4.2, 1.086],
    [4.4, 1.068],
    [4.512, 1.03],
    [4.556, 0.92],
    [4.57, 0.75],
    [4.552, 0.556],
    [4.516, 0.418],
    [4.448, 0.348],
  ],
  rearLower: [
    [4.36, 0.304],
    [4.24, 0.298],
  ],
  rocker: [
    [3.28, 0.294],
    [2.6, 0.29],
    [2.0, 0.292],
    [1.56, 0.298],
  ],
  frontLower: [
    [0.29, 0.286],
    [0.212, 0.298],
  ],
  shoulder: [
    [0.176, 0.694],
    [0.3, 0.752],
    [0.56, 0.8],
    [0.9, 0.842],
    [1.18, 0.882],
    [1.35, 0.918],
    [1.7, 0.934],
    [2.2, 0.944],
    [2.8, 0.954],
    [3.4, 0.972],
    [3.9, 1.004],
    [4.33, 1.052],
    [4.512, 1.03],
  ],
  dlo: [
    [1.58, 0.966],
    [1.86, 1.13],
    [2.14, 1.296],
    [2.32, 1.354],
    [2.7, 1.378],
    [3.02, 1.358],
    [3.32, 1.288],
    [3.64, 1.176],
    [3.86, 1.098],
    [3.56, 1.036],
    [3.0, 1.0],
    [2.3, 0.984],
    [1.8, 0.976],
  ],
  wsBase: [1.35, 0.918],
  wsTop: [2.18, 1.362],
  wsZ: [0.09, 0.22],
  doors: [1.64, 2.7, 3.7],
  handles: [2.34, 3.4],
  hoodFrontX: 0.176,
  deckEndX: 4.512,
  cowl: [1.35, 0.918],
  crown: 0.045,
  lamp: { y: [0.598, 0.652], inset: 0.13 },
  lampSide: [
    [0.104, 0.606],
    [0.22, 0.638],
    [0.35, 0.662],
    [0.356, 0.626],
    [0.23, 0.602],
    [0.116, 0.568],
  ],
  intake: { y: [0.316, 0.446], inset: 0.38 },
  vent: { y: [0.34, 0.56], w: 0.14 },
  mirror: { x: 1.72, y: 0.985, w: 0.2, h: 0.085, out: 0.17 },
  tailLamp: [
    [4.28, 1.016],
    [4.44, 0.99],
    [4.548, 0.936],
    [4.536, 0.9],
    [4.43, 0.952],
    [4.28, 0.978],
  ],
  deckCutX: 4.05,
};

const SUV: Spec = {
  L: 4.55,
  W: 1.92,
  axleF: 0.94,
  axleR: 3.78,
  R: 0.366,
  archGap: 0.084,
  rockerY: 0.38,
  beltY: 1.1,
  roofY: 1.72,
  bulgeF: 0.15,
  outlineTop: [
    [0.222, 0.372],
    [0.13, 0.478],
    [0.096, 0.608],
    [0.114, 0.722],
    [0.186, 0.802],
    [0.33, 0.878],
    [0.62, 0.932],
    [0.98, 0.982],
    [1.26, 1.03],
    [1.42, 1.068],
    [1.64, 1.2],
    [1.9, 1.39],
    [2.15, 1.56],
    [2.36, 1.66],
    [2.62, 1.706],
    [3.0, 1.716],
    [3.4, 1.7],
    [3.86, 1.668],
    [4.14, 1.63],
    [4.32, 1.564],
    [4.44, 1.43],
    [4.5, 1.25],
    [4.53, 1.04],
    [4.542, 0.83],
    [4.526, 0.64],
    [4.48, 0.5],
    [4.4, 0.428],
  ],
  rearLower: [
    [4.32, 0.384],
    [4.2, 0.378],
  ],
  rocker: [
    [3.28, 0.374],
    [2.5, 0.37],
    [1.9, 0.372],
    [1.62, 0.378],
  ],
  frontLower: [
    [0.3, 0.362],
    [0.222, 0.372],
  ],
  shoulder: [
    [0.186, 0.802],
    [0.33, 0.878],
    [0.62, 0.932],
    [0.98, 0.982],
    [1.26, 1.03],
    [1.42, 1.068],
    [1.75, 1.086],
    [2.3, 1.096],
    [2.9, 1.106],
    [3.5, 1.124],
    [4.02, 1.16],
    [4.3, 1.205],
    [4.42, 1.222],
  ],
  dlo: [
    [1.64, 1.116],
    [1.92, 1.304],
    [2.19, 1.476],
    [2.38, 1.58],
    [2.76, 1.63],
    [3.18, 1.64],
    [3.56, 1.612],
    [3.86, 1.552],
    [4.06, 1.48],
    [4.11, 1.3],
    [3.6, 1.196],
    [2.9, 1.156],
    [2.2, 1.132],
    [1.85, 1.126],
  ],
  wsBase: [1.42, 1.068],
  wsTop: [2.15, 1.56],
  wsZ: [0.1, 0.24],
  doors: [1.7, 2.76, 3.78],
  handles: [2.36, 3.4],
  hoodFrontX: 0.186,
  deckEndX: 4.53,
  cowl: [1.42, 1.068],
  crown: 0.05,
  lamp: { y: [0.688, 0.752], inset: 0.14 },
  lampSide: [
    [0.116, 0.702],
    [0.24, 0.74],
    [0.37, 0.766],
    [0.376, 0.728],
    [0.25, 0.702],
    [0.128, 0.662],
  ],
  intake: { y: [0.396, 0.546], inset: 0.4 },
  vent: { y: [0.42, 0.65], w: 0.15 },
  mirror: { x: 1.78, y: 1.135, w: 0.21, h: 0.09, out: 0.18 },
  tailLamp: [
    [4.32, 1.264],
    [4.46, 1.19],
    [4.522, 1.086],
    [4.508, 1.046],
    [4.43, 1.15],
    [4.32, 1.226],
  ],
  deckCutX: 4.18,
};

const SPECS: Record<BodyStyle, Spec> = { sedan: SEDAN, suv: SUV };

/* ── Camera ───────────────────────────────────────────────────────────────
   A real pinhole camera, 32° off the flank and set a shade above the
   beltline, 17 lengths away: the far side of the car comes out about 8%
   shorter and the far wheels about 10% smaller without a single hand-tuned
   number. The side view is a true orthographic elevation.                  */

const YAW = 29;
const DIST = 15;

type Proj = (x: number, y: number, z?: number) => Pt;

interface Frame {
  p: Proj;
  /** Pixels per unit at the near flank. */
  k: number;
}

function frame(spec: Spec, view: View): Frame {
  const q3 = view === 'front-3q';
  let raw: Proj;
  if (q3) {
    const yaw = (YAW * Math.PI) / 180;
    const T: V3 = [spec.L * 0.47, spec.beltY * 0.66, spec.W / 2];
    const C: V3 = [T[0] - Math.sin(yaw) * DIST, spec.roofY + 0.2, T[2] - Math.cos(yaw) * DIST];
    const f = unit(sub(T, C));
    const r = unit(cross([0, 1, 0], f));
    const u = cross(f, r);
    raw = (x, y, z = 0) => {
      const d = sub([x, y, z], C);
      const w = dot(d, f);
      return [(dot(d, r) / w) * DIST, (-dot(d, u) / w) * DIST];
    };
  } else {
    raw = (x, y) => [x, -y];
  }

  /* Fit the silhouette into the frame so both bodies and both cameras land
     at the same visual weight. */
  const ext: Pt[] = [];
  const zs = q3 ? [0, spec.W] : [0];
  for (const [x, y] of spec.outlineTop) for (const z of zs) ext.push(raw(x, y, z));
  for (const z of zs) {
    ext.push(raw(spec.outlineTop[0][0] - spec.bulgeF, 0.42, spec.W / 2));
    ext.push(raw(spec.axleF, 0, z === 0 ? 0.14 : spec.W - 0.14));
    ext.push(raw(spec.axleR, 0, z === 0 ? 0.14 : spec.W - 0.14));
  }
  const xs = ext.map((e) => e[0]);
  const ys = ext.map((e) => e[1]);
  const bx0 = Math.min(...xs);
  const bx1 = Math.max(...xs);
  const by0 = Math.min(...ys);
  const by1 = Math.max(...ys);
  const boxW = q3 ? 1104 : 1116;
  const boxH = 326;
  const k = Math.min(boxW / (bx1 - bx0), boxH / (by1 - by0));
  const ox = (VIEW_W - (bx1 - bx0) * k) / 2 - bx0 * k;
  const oy = 32 + (boxH - (by1 - by0) * k) / 2 - by0 * k;
  return { p: (x, y, z = 0) => { const q = raw(x, y, z); return [ox + q[0] * k, oy + q[1] * k]; }, k };
}

/* ── Geometry ─────────────────────────────────────────────────────────────*/

function tyreR(spec: Spec, size: number): number {
  return spec.R + (Math.min(22, Math.max(17, size)) - 19) * 0.006;
}

interface Wheel3 {
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  by: number;
  far: boolean;
  shade: number;
}

interface Geo {
  outline: string;
  shell: string[];
  crease: string;
  shellAxis: [Pt, Pt];
  face: string;
  farBody: string;
  faceAxis: [Pt, Pt];
  faceVert: [Pt, Pt];
  faceSplit: string;
  faceLip: string;
  intake: string;
  vents: string[];
  lampBar: string;
  lampCore: string;
  lampRecess: string;
  faceGleam: string;
  splitter: string;
  lampSide: string;
  windscreen: string;
  wsGlare: string;
  wsGlareAxis: [Pt, Pt];
  wipers: string[];
  dlo: string;
  dloTopRail: string;
  pillarA: string;
  pillarLead: string;
  pillarAxis: [Pt, Pt];
  pillarB: string;
  glassAxis: [Pt, Pt];
  band: (t0: number, t1: number, x0?: number, x1?: number) => string;
  line: (t: number, x0?: number, x1?: number) => string;
  flankAxis: [Pt, Pt];
  alongAxis: [Pt, Pt];
  archOutline: string[];
  archPocket: string[];
  archLip: string[];
  haunch: { cx: number; cy: number; rx: number; ry: number }[];
  doorCuts: string[];
  hoodCut: string;
  deckCut: string;
  handles: { d: string; hi: string }[];
  mirrorNear: string;
  mirrorFar: string;
  mirrorGlass: string;
  tailLamp: string;
  under: string;
  underAxis: [Pt, Pt];
  wheels: Wheel3[];
  contacts: { x: number; y: number; r: number; far: boolean }[];
  ground: { angle: number; cx: number; cy: number; span: number };
  fadePx: number;
}

function build(spec: Spec, view: View, size: number): Geo {
  const { p, k } = frame(spec, view);
  const q3 = view === 'front-3q';
  const R = tyreR(spec, size);
  const a = R + spec.archGap;
  const W = spec.W;
  const nearZ = 0;
  /* The arch is projected in the wheel's own plane: an arch cut on the outer
     skin would sit a parallax-width ahead of the tyre it is meant to frame. */
  const wheelZ = q3 ? 0.075 : 0;

  /* Wheel arches, drawn tail-end first so they run with the lower silhouette. */
  const archPts = (cx: number, grow = 0): P2[] => {
    const rr = a + grow;
    const t0 = Math.asin(Math.max(-0.9, Math.min(0.9, (spec.rockerY - R) / rr)));
    return samples(t0, Math.PI - t0, 16).map((t) => [cx + rr * Math.cos(t), R + rr * Math.sin(t)] as P2);
  };

  const proj = (pts: P2[], z: number) => pts.map(([x, y]) => p(x, y, z));
  const outline = curve(
    [
      ...proj(spec.outlineTop, nearZ),
      ...proj(spec.rearLower, nearZ),
      ...proj(archPts(spec.axleR), wheelZ),
      ...proj(spec.rocker, nearZ),
      ...proj(archPts(spec.axleF), wheelZ),
      ...proj(spec.frontLower, nearZ),
    ],
    true
  );

  /* Plan view: the fascia bulges forward at the centreline and tucks back at
     the corners, so the nose reads wide and the tail narrows. */
  const bulge = (z: number) => spec.bulgeF * Math.sin((Math.PI * z) / W);
  const nose = spec.outlineTop.slice(0, 4);
  const yLo = nose[0][1];
  const yHi = nose[nose.length - 1][1];

  /* Top surfaces — hood, roof and deck are one lofted shell swept from the
     near shoulder to the far one, crowned along the centreline. Because the
     camera sits a hair above the roof, the hood opens up and the roof stays a
     sliver, exactly as it does in a studio frame. */
  const topProfile = spec.outlineTop.filter(
    ([x]) => x >= spec.hoodFrontX - 0.001 && x <= spec.deckEndX + 0.001
  );
  const shellPt = (i: number, z: number): Pt => {
    const [x, y] = topProfile[i];
    const t = Math.max(0, (1.05 - x) / (1.05 - spec.hoodFrontX));
    const taper = x < spec.cowl[0] ? 1 : x > spec.deckEndX - 0.6 ? 0.8 : 0.5;
    const rise = spec.crown * taper * Math.sin((Math.PI * z) / W);
    return p(x - bulge(z) * t, y + rise, z);
  };
  const shellEdge = (z: number) => topProfile.map((_, i) => shellPt(i, z));
  const shell = [ribbon(shellEdge(W / 2), shellEdge(0)), ribbon(shellEdge(W), shellEdge(W / 2))];
  const crease = curve(shellEdge(W / 2));
  const shellAxis: [Pt, Pt] = [shellPt(2, 0), shellPt(2, W)];

  /* Front fascia: the nose profile swept across the car. */
  const faceZ = samples(0, W, 16);
  const faceX = (y: number, z: number) => {
    const t = 1 - Math.max(0, Math.min(1, (y - yLo) / (yHi - yLo))) * 0.25;
    /* The far corner tucks back along the car, so the fascia rounds off there
       instead of ending on a ruled vertical edge. */
    return -bulge(z) * t + 0.11 * (z / W) ** 4;
  };
  const faceTop = faceZ.map((z) => p(nose[3][0] + faceX(yHi, z), yHi, z));
  const faceFarEdge = [...nose].reverse().map(([x, y]) => p(x + faceX(y, W), y, W));
  const faceBottom = [...faceZ].reverse().map((z) => p(nose[0][0] + faceX(yLo, z), yLo, z));
  const faceNear = nose.map(([x, y]) => p(x, y, 0));
  const face = curve([...faceNear, ...faceTop.slice(1), ...faceFarEdge.slice(1), ...faceBottom.slice(1)], true);
  const faceAxis: [Pt, Pt] = [p(0.15, 0.55, 0), p(0.15 - spec.bulgeF, 0.55, W)];
  const faceVert: [Pt, Pt] = [p(0.14 - spec.bulgeF, yHi, W / 2), p(0.14 - spec.bulgeF, yLo - 0.03, W / 2)];
  const sweep = (y: number, inset = 0, n = 12, far = W - inset) =>
    samples(inset, far, n).map((z) => p(nose[0][0] + faceX(y, z), y, z));
  const splitY = (spec.lamp.y[0] + spec.intake.y[1]) / 2;
  const faceSplit = curve(sweep(splitY));
  const faceLip = curve(sweep(yLo + 0.028));

  const bandFace = (y0: number, y1: number, inset: number, far = W - inset) =>
    `${curve(sweep(y1, inset, 12, far))} ${curve([...sweep(y0, inset, 12, far)].reverse()).replace('M', 'L')} Z`;

  /* The far flank, as one dark mass. Nothing of it is lit, but it has to be
     there or the far wheels show straight through the car. */
  const farBody = curve(
    [...spec.outlineTop, ...spec.rearLower, ...spec.rocker, ...spec.frontLower].map(([x, y]) =>
      p(x, y, W - 0.02)
    ),
    true
  );

  const intake = bandFace(spec.intake.y[0], spec.intake.y[1], spec.intake.inset);
  const ventAt = (z0: number, z1: number) =>
    `${curve(samples(z0, z1, 4).map((z) => p(nose[0][0] + faceX(spec.vent.y[1], z), spec.vent.y[1], z)))} ${curve(
      samples(z1, z0, 4).map((z) => p(nose[0][0] + faceX(spec.vent.y[0], z), spec.vent.y[0], z))
    ).replace('M', 'L')} Z`;
  const vents = [ventAt(0.045, 0.045 + spec.vent.w), ventAt(W - 0.045 - spec.vent.w, W - 0.045)];

  const lampBar = bandFace(spec.lamp.y[0], spec.lamp.y[1], 0.012, W - spec.lamp.inset);
  const lampCore = curve(sweep((spec.lamp.y[0] + spec.lamp.y[1]) / 2 + 0.006, 0.03, 12, W - spec.lamp.inset - 0.02));
  const lampRecess = bandFace(spec.lamp.y[0] - 0.02, spec.lamp.y[1] + 0.02, 0, W - spec.lamp.inset + 0.02);
  const faceGleam = `${curve(
    samples(0.26, 0.5, 5).map((f) => p(nose[0][0] + faceX(yHi, W * f), yHi - 0.01, W * f))
  )} ${curve(samples(0.5, 0.26, 5).map((f) => p(nose[0][0] + faceX(yLo, W * f), yLo + 0.02, W * f))).replace(
    'M',
    'L'
  )} Z`;
  const splitter = curve(sweep(yLo + 0.052, spec.intake.inset - 0.1));
  const lampSide = curve(spec.lampSide.map(([x, y]) => p(x, y, nearZ)), true);

  /* Glass. */
  /* The header rail: the screen stops a hair short of the roof edge so no part
     of it — nor of anything clipped to it — can land on painted metal. */
  const wsTopY = spec.wsTop[1] - 0.016;
  const windscreen = poly([
    p(spec.wsBase[0], spec.wsBase[1], spec.wsZ[0]),
    p(spec.wsTop[0], wsTopY, spec.wsZ[1]),
    p(spec.wsTop[0], wsTopY, W - spec.wsZ[1]),
    p(spec.wsBase[0], spec.wsBase[1], W - spec.wsZ[0]),
  ]);
  /* The reflection is laid out in the screen's own parameters — u across the
     car, t up the glass — so it can only ever land on glass, and its leading
     edge bows with the cylindrical section instead of ruling a straight line. */
  const wsPt = (u: number, t: number): Pt => {
    const zLo = spec.wsZ[0] + (spec.wsZ[1] - spec.wsZ[0]) * t;
    return p(
      spec.wsBase[0] + (spec.wsTop[0] - spec.wsBase[0]) * t,
      spec.wsBase[1] + (spec.wsTop[1] - spec.wsBase[1]) * t,
      zLo + (W - 2 * zLo) * u
    );
  };
  /* Trailing edge hugs the A-pillar; leading edge swells out across the middle
     of the screen, which is the curve a cylinder puts into a straight horizon. */
  const wsTrailU = (t: number) => 0.015 + 0.05 * t;
  const wsLeadU = (t: number) => 0.29 + 0.24 * t + 0.13 * Math.sin(Math.PI * t);
  const wsTs = samples(0.04, 0.95, 14);
  const wsGlare = ribbon(
    wsTs.map((t) => wsPt(wsTrailU(t), t)),
    wsTs.map((t) => wsPt(wsLeadU(t), t))
  );
  const wsGlareAxis: [Pt, Pt] = [wsPt(wsTrailU(0.5), 0.5), wsPt(wsLeadU(0.5) + 0.04, 0.5)];
  const wipers = [0.34, 0.62].map((f) =>
    curve([
      p(spec.wsBase[0] + 0.02, spec.wsBase[1] + 0.005, W * f - 0.2),
      p(spec.wsBase[0] + 0.12, spec.wsBase[1] + 0.055, W * f + 0.02),
      p(spec.wsBase[0] + 0.2, spec.wsBase[1] + 0.085, W * f + 0.24),
    ])
  );
  const glassZ = q3 ? 0.06 : 0;
  const dlo = curve(spec.dlo.map(([x, y]) => p(x, y, glassZ)), true);
  const dloTopRail = curve(spec.dlo.slice(0, 9).map(([x, y]) => p(x, y, glassZ)));
  /* The A-pillar. Its crown is tucked a hair under the roof rail so it ends on
     paint rather than butting the roof, and it is shaded across its width — a
     lit leading edge against the screen, shadow where it turns to the door. */
  const pillarWs: [Pt, Pt] = [
    p(spec.wsBase[0], spec.wsBase[1], spec.wsZ[0]),
    p(spec.wsTop[0], wsTopY, spec.wsZ[1]),
  ];
  const pillarDlo: [Pt, Pt] = [
    p(spec.dlo[3][0], spec.dlo[3][1] - 0.014, glassZ),
    p(spec.dlo[0][0], spec.dlo[0][1], glassZ),
  ];
  const pillarA = poly([pillarWs[0], pillarWs[1], pillarDlo[0], pillarDlo[1]]);
  const pillarLead = poly([pillarWs[0], pillarWs[1]], false);
  const pillarAxis: [Pt, Pt] = [
    [(pillarWs[0][0] + pillarWs[1][0]) / 2, (pillarWs[0][1] + pillarWs[1][1]) / 2],
    [(pillarDlo[0][0] + pillarDlo[1][0]) / 2, (pillarDlo[0][1] + pillarDlo[1][1]) / 2],
  ];
  const bIdx = spec.doors[1];
  const pillarB = poly([
    p(bIdx, yAt(spec.dlo.slice(0, 9), bIdx) - 0.004, glassZ),
    p(bIdx + 0.05, yAt(spec.dlo.slice(0, 9), bIdx + 0.05) - 0.004, glassZ),
    p(bIdx + 0.05, spec.beltY + 0.05, glassZ),
    p(bIdx, spec.beltY + 0.05, glassZ),
  ]);
  const glassAxis: [Pt, Pt] = [p(2.6, spec.roofY - 0.05, glassZ), p(2.6, spec.beltY - 0.02, glassZ)];

  /* ── The tonal scaffolding for the flank ───────────────────────────────
     Every band is drawn between two curves that are blends of the shoulder
     line and the sill line, so each one bows exactly the way the panel it
     lies on bows. Nothing on this car is a straight stripe.               */
  const mid = (spec.axleF + spec.axleR) / 2;
  const half = (spec.axleR - spec.axleF) / 2;
  const sillY = (x: number) => spec.rockerY + 0.03 * ((x - mid) / half) ** 2;
  const mixY = (x: number, t: number) => {
    const s = sillY(x);
    return s + (yAt(spec.shoulder, x) - s) * t;
  };
  const bx0 = spec.frontLower[1][0] + 0.02;
  const bx1 = spec.outlineTop[spec.outlineTop.length - 1][0] - 0.02;
  const edge = (t: number, x0: number, x1: number) =>
    samples(x0, x1, 22).map((x) => p(x, mixY(x, t), nearZ));
  const band = (t0: number, t1: number, x0 = bx0, x1 = bx1) => ribbon(edge(t1, x0, x1), edge(t0, x0, x1));
  const line = (t: number, x0 = bx0, x1 = bx1) => curve(edge(t, x0, x1));
  const flankAxis: [Pt, Pt] = [p(mid, yAt(spec.shoulder, mid), nearZ), p(mid, sillY(mid) - 0.08, nearZ)];
  const alongAxis: [Pt, Pt] = [p(bx0, spec.beltY, nearZ), p(bx1, spec.beltY, nearZ)];

  const archOutline = [spec.axleF, spec.axleR].map((cx) => curve(proj(archPts(cx), wheelZ)));
  const archPocket = [spec.axleF, spec.axleR].map((cx) => {
    const pts = proj(archPts(cx), wheelZ);
    return `${curve(pts)} L ${fmt(p(cx - a * 0.99, spec.rockerY - 0.012, wheelZ))} L ${fmt(
      p(cx + a * 0.99, spec.rockerY - 0.012, wheelZ)
    )} Z`;
  });
  const archLip = [spec.axleF, spec.axleR].map((cx) =>
    curve(proj(archPts(cx, 0.014).slice(4, 12), wheelZ))
  );
  const haunch = [spec.axleF, spec.axleR].map((cx) => {
    const c = p(cx + (cx === spec.axleF ? 0.1 : -0.1), R + a * 1.02, nearZ);
    return { cx: c[0], cy: c[1], rx: a * k * 1.25, ry: a * k * 0.3 };
  });

  const doorCuts = spec.doors.map((x) =>
    curve(
      samples(0.02, 0.99, 6).map((t) => p(x - 0.03 * Math.sin(t * Math.PI * 0.5), mixY(x, t), nearZ))
    )
  );
  const hoodCut = curve([
    p(spec.cowl[0] - 0.01, spec.cowl[1] - 0.006, nearZ),
    p(spec.cowl[0] + 0.03, mixY(spec.cowl[0], 0.55), nearZ),
    p(spec.cowl[0] + 0.06, mixY(spec.cowl[0], 0.2), nearZ),
  ]);
  const deckCut = curve([
    p(spec.deckCutX - 0.05, yAt(spec.shoulder, spec.deckCutX) + 0.005, nearZ),
    p(spec.deckCutX, mixY(spec.deckCutX, 0.55), nearZ),
    p(spec.deckCutX + 0.04, mixY(spec.deckCutX, 0.16), nearZ),
  ]);

  const handles = spec.handles.map((x) => {
    const y = yAt(spec.shoulder, x) - 0.085;
    const pts = [
      p(x - 0.105, y + 0.012, nearZ),
      p(x + 0.105, y + 0.016, nearZ),
      p(x + 0.105, y - 0.018, nearZ),
      p(x - 0.105, y - 0.022, nearZ),
    ];
    return { d: poly(pts), hi: poly([pts[0], pts[1], p(x + 0.105, y + 0.006, nearZ), p(x - 0.105, y + 0.002, nearZ)]) };
  });

  const m = spec.mirror;
  const mirrorShape = (z: number) =>
    curve(
      [
        [m.x, m.y],
        [m.x + m.w * 0.5, m.y + 0.016],
        [m.x + m.w, m.y - 0.008],
        [m.x + m.w * 0.94, m.y - m.h],
        [m.x + m.w * 0.36, m.y - m.h - 0.012],
        [m.x + 0.012, m.y - m.h * 0.62],
      ].map(([x, y]) => p(x, y, z)),
      true
    );
  const mirrorNear = mirrorShape(-m.out);
  const mirrorFar = mirrorShape(W + m.out);
  const mirrorGlass = curve(
    [
      [m.x + 0.03, m.y - 0.004],
      [m.x + m.w * 0.55, m.y + 0.006],
      [m.x + m.w * 0.9, m.y - 0.016],
      [m.x + m.w * 0.82, m.y - m.h * 0.86],
      [m.x + m.w * 0.36, m.y - m.h * 0.94],
      [m.x + 0.036, m.y - m.h * 0.56],
    ].map(([x, y]) => p(x, y, -m.out)),
    true
  );

  const tailLamp = curve(spec.tailLamp.map(([x, y]) => p(x, y, nearZ)), true);

  /* Everything under the sill reads as one soft dark mass that tucks in at
     the floor, so it never squares off into a slab. */
  const under = curve(
    [
      p(spec.axleR + 0.62, spec.rockerY - 0.02, nearZ),
      p(spec.axleR, spec.rockerY + 0.02, nearZ),
      p(mid, spec.rockerY - 0.005, nearZ),
      p(spec.axleF, spec.rockerY + 0.02, nearZ),
      p(spec.axleF - 0.42, spec.rockerY - 0.04, nearZ),
      p(0.4, yLo - 0.02, nearZ),
      p(0.52, 0.07, nearZ),
      p(spec.axleF, 0.02, nearZ),
      p(mid, 0.0, nearZ),
      p(spec.axleR, 0.02, nearZ),
      p(spec.axleR + 0.4, 0.1, nearZ),
    ],
    true
  );
  const underAxis: [Pt, Pt] = [p(mid, spec.rockerY, nearZ), p(mid, 0, nearZ)];

  /* Wheels: near pair, plus the far front wheel which the perspective makes
     about a tenth smaller on its own. */
  const mk = (axle: number, z: number, far: boolean, shade: number): Wheel3 => {
    const c = p(axle, R, z);
    const ex = p(axle + R, R, z);
    const dn = p(axle, 0, z);
    return { cx: c[0], cy: c[1], ax: ex[0] - c[0], ay: ex[1] - c[1], by: dn[1] - c[1], far, shade };
  };
  /* The far pair stand on the same floor as the near pair — their contact
     patches are just further from the lens — but they are seen almost edge-on
     past the body, so they are squashed to a sliver of their rolling width and
     clipped to the silhouette. Nothing of them may reach past sheet metal. */
  const farSquash = 0.4;
  const wheels: Wheel3[] = [];
  const contacts: Geo['contacts'] = [];
  if (q3) {
    for (const [axle, shade] of [
      [spec.axleF, 0.9],
      [spec.axleR, 0.92],
    ] as const) {
      const w = mk(axle, W - 0.11, true, shade);
      contacts.push({ x: w.cx, y: w.cy + w.by, r: Math.abs(w.ax), far: true });
      wheels.push({ ...w, ax: w.ax * farSquash, ay: w.ay * farSquash });
    }
  }
  wheels.push(mk(spec.axleR, wheelZ, false, q3 ? 0.1 : 0.06));
  wheels.push(mk(spec.axleF, wheelZ, false, 0));

  for (const w of wheels) {
    if (!w.far) contacts.push({ x: w.cx, y: w.cy + w.by, r: Math.abs(w.ax), far: false });
  }
  const cF = p(spec.axleF, 0, wheelZ);
  const cR = p(spec.axleR, 0, wheelZ);
  const ground = {
    angle: (Math.atan2(cR[1] - cF[1], cR[0] - cF[0]) * 180) / Math.PI,
    cx: (cF[0] + cR[0]) / 2,
    cy: (cF[1] + cR[1]) / 2,
    span: Math.hypot(cR[0] - cF[0], cR[1] - cF[1]),
  };

  return {
    outline,
    shell,
    crease,
    shellAxis,
    face,
    farBody,
    faceAxis,
    faceVert,
    faceSplit,
    faceLip,
    intake,
    vents,
    lampBar,
    lampCore,
    lampRecess,
    faceGleam,
    splitter,
    lampSide,
    windscreen,
    wsGlare,
    wsGlareAxis,
    wipers,
    dlo,
    dloTopRail,
    pillarA,
    pillarLead,
    pillarAxis,
    pillarB,
    glassAxis,
    band,
    line,
    flankAxis,
    alongAxis,
    archOutline,
    archPocket,
    archLip,
    haunch,
    doorCuts,
    hoodCut,
    deckCut,
    handles,
    mirrorNear,
    mirrorFar,
    mirrorGlass,
    tailLamp,
    under,
    underAxis,
    wheels,
    contacts,
    ground,
    fadePx: R * k,
  };
}

function describe(body: BodyStyle, paint: PaintOption, wheel: WheelOption, view: View): string {
  const shape = body === 'suv' ? 'SUV' : 'sedan';
  const angle = view === 'side' ? 'side profile' : 'front three-quarter view';
  return `Vela ${shape} in ${paint.name} with ${wheel.name}, ${angle}`;
}

/* ── Component ────────────────────────────────────────────────────────────*/

export default function CarRender({
  body,
  paint,
  wheel,
  view = 'front-3q',
  ground = true,
  className,
  label,
}: CarRenderProps): ReactElement {
  const uid = `b${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const spec = SPECS[body] ?? SEDAN;
  const g = build(spec, view, wheel.size);
  const q3 = view === 'front-3q';
  const [fa, fb] = g.flankAxis;
  const [aa, ab] = g.alongAxis;
  const [ha, hb] = g.shellAxis;
  const [ca, cb] = g.faceAxis;
  const [va, vb] = g.faceVert;
  const [ga, gb] = g.glassAxis;
  const [wa, wb] = g.wsGlareAxis;
  const [pa, pb] = g.pillarAxis;
  const [ua, ub] = g.underAxis;
  const gr = g.ground;
  const flip = `translate(${gr.cx.toFixed(1)} ${gr.cy.toFixed(1)}) rotate(${gr.angle.toFixed(2)})`;

  return (
    <svg
      className={className ? `car-render ${className}` : 'car-render'}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label ?? describe(body, paint, wheel, view)}
    >
      <defs>
        {/* Paint. The flank runs sky → body → floor down the panel; the neutral
            bands layered over it supply the studio. */}
        <linearGradient id={`${uid}-flank`} gradientUnits="userSpaceOnUse" x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]}>
          <stop offset="0" stopColor={paint.sheen} data-paint />
          <stop offset="0.1" stopColor={paint.hex} data-paint />
          <stop offset="0.52" stopColor={paint.hex} data-paint />
          <stop offset="0.88" stopColor={paint.shade} data-paint />
          <stop offset="1" stopColor={paint.shade} data-paint />
        </linearGradient>
        <linearGradient id={`${uid}-top`} gradientUnits="userSpaceOnUse" x1={ha[0]} y1={ha[1]} x2={hb[0]} y2={hb[1]}>
          <stop offset="0" stopColor={paint.hex} data-paint />
          <stop offset="0.42" stopColor={paint.sheen} data-paint />
          <stop offset="0.66" stopColor={paint.hex} data-paint />
          <stop offset="1" stopColor={paint.shade} data-paint />
        </linearGradient>
        <linearGradient id={`${uid}-topShade`} gradientUnits="userSpaceOnUse" x1={ha[0]} y1={ha[1]} x2={hb[0]} y2={hb[1]}>
          <stop offset="0" stopColor="#05070a" stopOpacity="0.1" />
          <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.8" stopColor="#05070a" stopOpacity="0.1" />
          <stop offset="1" stopColor="#05070a" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`${uid}-faceP`} gradientUnits="userSpaceOnUse" x1={ca[0]} y1={ca[1]} x2={cb[0]} y2={cb[1]}>
          <stop offset="0" stopColor={paint.hex} data-paint />
          <stop offset="0.35" stopColor={paint.hex} data-paint />
          <stop offset="1" stopColor={paint.shade} data-paint />
        </linearGradient>
        <linearGradient id={`${uid}-far`} gradientUnits="userSpaceOnUse" x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]}>
          <stop offset="0" stopColor={paint.hex} data-paint />
          <stop offset="1" stopColor={paint.shade} data-paint />
        </linearGradient>

        {/* Neutral studio light. */}
        <linearGradient id={`${uid}-skyband`} gradientUnits="userSpaceOnUse" x1={aa[0]} y1={aa[1]} x2={ab[0]} y2={ab[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="0.2" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="0.52" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="0.86" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={`${uid}-underCrease`} gradientUnits="userSpaceOnUse" x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]}>
          <stop offset="0" stopColor="#0a0d12" stopOpacity="0.5" />
          <stop offset="0.3" stopColor="#0a0d12" stopOpacity="0.14" />
          <stop offset="1" stopColor="#0a0d12" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-horizon`} gradientUnits="userSpaceOnUse" x1={aa[0]} y1={aa[1]} x2={ab[0]} y2={ab[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="0.16" stopColor="#ffffff" stopOpacity="0.44" />
          <stop offset="0.46" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.72" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id={`${uid}-floorRefl`} gradientUnits="userSpaceOnUse" x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-sill`} gradientUnits="userSpaceOnUse" x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]}>
          <stop offset="0" stopColor="#05070a" stopOpacity="0" />
          <stop offset="0.55" stopColor="#05070a" stopOpacity="0.14" />
          <stop offset="1" stopColor="#05070a" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={`${uid}-bounce`} gradientUnits="userSpaceOnUse" x1={aa[0]} y1={aa[1]} x2={ab[0]} y2={ab[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.24" />
          <stop offset="0.75" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-haunch`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.13" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Glass — its own blue-grey, never the paint. */}
        <linearGradient id={`${uid}-glass`} gradientUnits="userSpaceOnUse" x1={ga[0]} y1={ga[1]} x2={gb[0]} y2={gb[1]}>
          <stop offset="0" stopColor="#5b6773" />
          <stop offset="0.28" stopColor="#2c343d" />
          <stop offset="0.66" stopColor="#181e25" />
          <stop offset="1" stopColor="#0d1116" />
        </linearGradient>
        <linearGradient id={`${uid}-ws`} gradientUnits="userSpaceOnUse" x1={ga[0]} y1={ga[1]} x2={gb[0]} y2={gb[1]}>
          <stop offset="0" stopColor="#6c7885" />
          <stop offset="0.4" stopColor="#333c46" />
          <stop offset="1" stopColor="#151a20" />
        </linearGradient>
        <linearGradient
          id={`${uid}-pillar`}
          gradientUnits="userSpaceOnUse"
          x1={pa[0]}
          y1={pa[1]}
          x2={pb[0]}
          y2={pb[1]}
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.22" stopColor="#ffffff" stopOpacity="0.07" />
          <stop offset="0.62" stopColor="#05070a" stopOpacity="0.12" />
          <stop offset="1" stopColor="#05070a" stopOpacity="0.3" />
        </linearGradient>
        {/* The screen reflection: no edge of it is a step — it comes up out of
            the glass and falls back into it. */}
        <linearGradient
          id={`${uid}-wsRefl`}
          gradientUnits="userSpaceOnUse"
          x1={wa[0]}
          y1={wa[1]}
          x2={wb[0]}
          y2={wb[1]}
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.22" stopColor="#eef3f8" stopOpacity="0.3" />
          <stop offset="0.58" stopColor="#dde5ee" stopOpacity="0.24" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={`${uid}-led`} gradientUnits="userSpaceOnUse" x1={ca[0]} y1={ca[1]} x2={cb[0]} y2={cb[1]}>
          <stop offset="0" stopColor="#b9cbe4" />
          <stop offset="0.22" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#fff6e4" />
          <stop offset="0.8" stopColor="#dce7f6" />
          <stop offset="1" stopColor="#8fa4c0" />
        </linearGradient>
        <linearGradient id={`${uid}-tail`} gradientUnits="userSpaceOnUse" x1={ab[0]} y1={ab[1]} x2={aa[0]} y2={aa[1]}>
          <stop offset="0" stopColor="#ff8a6a" />
          <stop offset="0.35" stopColor="#d8241d" />
          <stop offset="1" stopColor="#7d0d12" />
        </linearGradient>

        <linearGradient id={`${uid}-faceShade`} gradientUnits="userSpaceOnUse" x1={va[0]} y1={va[1]} x2={vb[0]} y2={vb[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="0.18" stopColor="#05070a" stopOpacity="0.16" />
          <stop offset="0.34" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="0.66" stopColor="#05070a" stopOpacity="0.2" />
          <stop offset="0.94" stopColor="#05070a" stopOpacity="0.46" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={`${uid}-under`} gradientUnits="userSpaceOnUse" x1={ua[0]} y1={ua[1]} x2={ub[0]} y2={ub[1]}>
          <stop offset="0" stopColor="#05070a" stopOpacity="0.92" />
          <stop offset="0.5" stopColor="#070a0e" stopOpacity="0.6" />
          <stop offset="1" stopColor="#0d1218" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-well`} gradientUnits="userSpaceOnUse" x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]}>
          <stop offset="0" stopColor="#161b21" />
          <stop offset="0.55" stopColor="#0b0e13" />
          <stop offset="1" stopColor="#05070a" />
        </linearGradient>
        <radialGradient id={`${uid}-pool`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0b0e12" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#0b0e12" stopOpacity="0.12" />
          <stop offset="1" stopColor="#0b0e12" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-patch`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#05070a" stopOpacity="0.62" />
          <stop offset="0.45" stopColor="#05070a" stopOpacity="0.32" />
          <stop offset="1" stopColor="#05070a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <RimDefs uid={uid} />

        <filter id={`${uid}-soft`} x="-40%" y="-400%" width="180%" height="900%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id={`${uid}-mid`} x="-40%" y="-400%" width="180%" height="900%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={`${uid}-tight`} x="-60%" y="-400%" width="220%" height="900%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <filter id={`${uid}-hair`} x="-60%" y="-400%" width="220%" height="900%">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>

        <clipPath id={`${uid}-clipBody`}>
          <path d={g.outline} />
        </clipPath>
        <clipPath id={`${uid}-clipFace`}>
          <path d={g.face} />
        </clipPath>
        <linearGradient id={`${uid}-farTyre`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#1b1f25" />
          <stop offset="0.6" stopColor="#0c0f13" />
          <stop offset="1" stopColor="#05070a" />
        </linearGradient>
        <linearGradient id={`${uid}-farRim`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#454b53" />
          <stop offset="0.55" stopColor="#262b31" />
          <stop offset="1" stopColor="#101317" />
        </linearGradient>

        {/* The far pair may only ever show through the car's own silhouette. */}
        <clipPath id={`${uid}-clipFar`}>
          <path d={g.outline} />
          {q3 && <path d={g.farBody} />}
          {q3 && <path d={g.face} />}
        </clipPath>
        <clipPath id={`${uid}-clipWs`}>
          <path d={g.windscreen} />
        </clipPath>
        <clipPath id={`${uid}-clipDlo`}>
          <path d={g.dlo} />
        </clipPath>
        <mask id={`${uid}-maskFloor`}>
          <g transform={flip}>
            <rect x="-700" y="0" width="2400" height={g.fadePx * 1.6} fill={`url(#${uid}-fade)`} />
          </g>
        </mask>
      </defs>

      {ground && (
        <g className="car-render__floor" mask={`url(#${uid}-maskFloor)`} opacity="0.11">
          <use
            href={`#${uid}-car`}
            transform={`${flip} scale(1 -1) rotate(${(-gr.angle).toFixed(2)}) translate(${(-gr.cx).toFixed(1)} ${(
              -gr.cy
            ).toFixed(1)})`}
            filter={`url(#${uid}-hair)`}
          />
        </g>
      )}

      {ground && (
        <g className="car-render__shadow">
          <g transform={`translate(${gr.cx.toFixed(1)} ${gr.cy.toFixed(1)}) rotate(${gr.angle.toFixed(2)})`}>
            <ellipse
              cx="0"
              cy="2"
              rx={gr.span / 2 + g.fadePx * 1.35}
              ry={g.fadePx * 0.42}
              fill={`url(#${uid}-pool)`}
              filter={`url(#${uid}-soft)`}
            />
          </g>
          {g.contacts.map((c) => (
            <g
              key={`${c.far ? 'f' : 'n'}${c.x.toFixed(1)}`}
              transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${gr.angle.toFixed(2)})`}
              opacity={c.far ? 0.3 : 1}
            >
              <ellipse
                cx="0"
                cy="1"
                rx={c.r * (c.far ? 1.0 : 1.15)}
                ry={c.r * (c.far ? 0.28 : 0.26)}
                fill={`url(#${uid}-patch)`}
                filter={`url(#${uid}-${c.far ? 'soft' : 'tight'})`}
              />
              {!c.far && (
                <ellipse
                  cx="0"
                  cy="0.5"
                  rx={c.r * 0.5}
                  ry={c.r * 0.1}
                  fill="#05070a"
                  opacity="0.5"
                  filter={`url(#${uid}-hair)`}
                />
              )}
            </g>
          ))}
        </g>
      )}

      <g id={`${uid}-car`}>
        {q3 && (
          <g clipPath={`url(#${uid}-clipFar)`}>
            {g.wheels
              .filter((w) => w.far)
              .map((w) => (
                <g
                  key={`f${w.cx.toFixed(1)}`}
                  transform={`matrix(${w.ax.toFixed(3)} ${w.ay.toFixed(3)} 0 ${w.by.toFixed(3)} ${w.cx.toFixed(
                    2
                  )} ${w.cy.toFixed(2)})`}
                >
                  <circle r="1" fill={`url(#${uid}-farTyre)`} />
                  <circle r={rimRatio(wheel.size)} fill={`url(#${uid}-farRim)`} />
                  <circle
                    r={rimRatio(wheel.size) * 0.34}
                    fill="#0a0d11"
                    stroke="#ffffff"
                    strokeOpacity="0.08"
                    strokeWidth="0.03"
                  />
                  <circle r="1" fill="#05070a" fillOpacity={w.shade * 0.7} />
                </g>
              ))}
          </g>
        )}

        {q3 && (
          <>
            <path d={g.farBody} fill={`url(#${uid}-far)`} data-paint />
            <path d={g.farBody} fill="#05070a" fillOpacity="0.5" />
          </>
        )}

        {/* ── Top surfaces. Drawn before the near flank so the body occludes
            whatever falls behind it ── */}
        {q3 && (
          <>
            {g.shell.map((d) => (
              <g key={d}>
                <path d={d} fill={`url(#${uid}-top)`} data-paint />
                <path d={d} fill={`url(#${uid}-topShade)`} />
              </g>
            ))}
            <path d={g.crease} fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="2.6" filter={`url(#${uid}-hair)`} />
          </>
        )}

        <path d={g.under} fill={`url(#${uid}-under)`} filter={`url(#${uid}-tight)`} />
        {g.archPocket.map((d) => (
          <path key={d} d={d} fill={`url(#${uid}-well)`} />
        ))}

        {g.wheels
          .filter((w) => !w.far)
          .map((w) => (
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

        {/* ── Near flank ──────────────────────────────────────────────────
            Base paint, then five neutral bands. Every band is bounded by
            curves blended between the shoulder and the sill, so each one
            bows the way its panel bows. */}
        <path d={g.outline} fill={`url(#${uid}-flank)`} data-paint />
        <g clipPath={`url(#${uid}-clipBody)`}>
          {/* 1 · the shoulder turn-over takes the sky */}
          <path d={g.band(0.86, 1.06)} fill={`url(#${uid}-skyband)`} filter={`url(#${uid}-mid)`} />
          {/* 2 · dark immediately under the character line — the tightest step */}
          <path d={g.band(0.6, 0.95)} fill={`url(#${uid}-underCrease)`} filter={`url(#${uid}-tight)`} />
          {/* 3 · the flank mirrors the floor: a soft horizon sweep, then dark to the sill */}
          <path d={g.band(0.3, 0.6)} fill={`url(#${uid}-floorRefl)`} filter={`url(#${uid}-mid)`} />
          <path d={g.band(-0.1, 0.4)} fill={`url(#${uid}-sill)`} filter={`url(#${uid}-mid)`} />
          {/* 4 · bounce off the tile, just above the rocker */}
          <path
            d={g.line(0.11)}
            fill="none"
            stroke={`url(#${uid}-bounce)`}
            strokeWidth={g.fadePx * 0.15}
            filter={`url(#${uid}-tight)`}
          />
          {/* fender crowns */}
          {g.haunch.map((h) => (
            <ellipse
              key={h.cx}
              cx={h.cx}
              cy={h.cy}
              rx={h.rx}
              ry={h.ry}
              fill={`url(#${uid}-haunch)`}
              filter={`url(#${uid}-mid)`}
            />
          ))}
          {/* 5 · arches and sill hold the darkest values on the car */}
          {g.archOutline.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="#05070a"
              strokeOpacity="0.4"
              strokeWidth={g.fadePx * 0.15}
              filter={`url(#${uid}-tight)`}
            />
          ))}
          {g.archLip.map((d) => (
            <path key={d} d={d} fill="none" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1" />
          ))}
          {/* the character line: a bright hairline with dark right beneath it */}
          <path d={g.line(0.95)} fill="none" stroke={`url(#${uid}-horizon)`} strokeWidth="3.4" filter={`url(#${uid}-hair)`} />
          <path d={g.line(0.95)} fill="none" stroke={`url(#${uid}-horizon)`} strokeWidth="1.1" />
          <path d={g.line(0.4)} fill="none" stroke="#ffffff" strokeOpacity="0.09" strokeWidth="1" />

          <g fill="none" strokeLinecap="round">
            {g.doorCuts.map((d) => (
              <g key={d}>
                <path d={d} stroke="#05070a" strokeOpacity="0.3" strokeWidth="0.9" />
                <path d={d} stroke="#ffffff" strokeOpacity="0.08" strokeWidth="0.7" transform="translate(1.4 0)" />
              </g>
            ))}
            <path d={g.hoodCut} stroke="#05070a" strokeOpacity="0.22" strokeWidth="0.8" />
            <path d={g.deckCut} stroke="#05070a" strokeOpacity="0.22" strokeWidth="0.8" />
          </g>

          {g.handles.map((h) => (
            <g key={h.d}>
              <path d={h.d} fill="#05070a" fillOpacity="0.3" />
              <path d={h.hi} fill="#ffffff" fillOpacity="0.32" />
            </g>
          ))}

          <path d={g.tailLamp} fill="#0b0e12" />
          <path d={g.tailLamp} fill={`url(#${uid}-tail)`} transform="translate(0 1)" opacity="0.95" />
          <path d={g.tailLamp} fill="none" stroke="#05070a" strokeOpacity="0.5" strokeWidth="0.9" />

          <path d={g.lampSide} fill="#0b0e12" fillOpacity="0.8" />
          <path d={g.lampSide} fill={`url(#${uid}-led)`} transform="translate(0 0.7)" opacity="0.85" />
        </g>

        {/* ── Glass ── */}
        <path d={g.dlo} fill={`url(#${uid}-glass)`} />
        <g clipPath={`url(#${uid}-clipDlo)`}>
          <path
            d={g.line(1.52)}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.11"
            strokeWidth={g.fadePx * 0.55}
            filter={`url(#${uid}-mid)`}
          />
          <path d={g.pillarB} fill="#0a0d11" fillOpacity="0.85" />
        </g>
        <path d={g.dloTopRail} fill="none" stroke="#ffffff" strokeOpacity="0.26" strokeWidth="1.1" />
        <path d={g.dlo} fill="none" stroke="#05070a" strokeOpacity="0.42" strokeWidth="1.5" />

        {q3 && (
          <>
            <path d={g.pillarA} fill="#141a21" />
            <path d={g.pillarA} fill={`url(#${uid}-pillar)`} />
            <path
              d={g.pillarLead}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.16"
              strokeWidth="1.4"
              filter={`url(#${uid}-hair)`}
            />
            <path d={g.windscreen} fill={`url(#${uid}-ws)`} />
            <g clipPath={`url(#${uid}-clipWs)`}>
              <path d={g.wsGlare} fill={`url(#${uid}-wsRefl)`} filter={`url(#${uid}-mid)`} />
              {g.wipers.map((d) => (
                <path key={d} d={d} fill="none" stroke="#05070a" strokeOpacity="0.35" strokeWidth="1.3" />
              ))}
            </g>
            <path d={g.windscreen} fill="none" stroke="#05070a" strokeOpacity="0.38" strokeWidth="1.3" />
            <path d={g.mirrorFar} fill={`url(#${uid}-far)`} data-paint />
            <path d={g.mirrorFar} fill="#05070a" fillOpacity="0.45" />
          </>
        )}

        <path d={g.mirrorNear} fill={`url(#${uid}-flank)`} data-paint />
        <path d={g.mirrorGlass} fill="#12161b" />
        <path d={g.mirrorNear} fill="none" stroke="#05070a" strokeOpacity="0.32" strokeWidth="0.9" />

        {/* ── Fascia — nearest the camera, so it lands last ── */}
        {q3 && (
          <>
            <path d={g.face} fill={`url(#${uid}-faceP)`} data-paint />
            <g clipPath={`url(#${uid}-clipFace)`}>
              <path d={g.face} fill={`url(#${uid}-faceShade)`} />
              {/* the convex nose gathers a soft vertical gleam off the ceiling */}
              <path d={g.faceGleam} fill="#ffffff" fillOpacity="0.1" filter={`url(#${uid}-soft)`} />
              {/* bumper crease */}
              <path d={g.faceSplit} fill="none" stroke="#05070a" strokeOpacity="0.16" strokeWidth="1.1" />
              <path d={g.faceSplit} fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" transform="translate(0 1.8)" />
              {/* lower intake, air curtains, splitter */}
              <path d={g.intake} fill="#0a0d11" fillOpacity="0.94" />
              <path d={g.intake} fill="none" stroke="#05070a" strokeOpacity="0.5" strokeWidth="2.4" filter={`url(#${uid}-hair)`} />
              <path d={g.intake} fill="none" stroke="#ffffff" strokeOpacity="0.13" strokeWidth="1.2" transform="translate(0 -2)" />
              {g.vents.map((d) => (
                <g key={d}>
                  <path d={d} fill="#0a0d11" fillOpacity="0.8" />
                  <path d={d} fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="0.9" />
                </g>
              ))}
              <path d={g.splitter} fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.6" filter={`url(#${uid}-hair)`} />
              <path d={g.faceLip} fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="2.4" filter={`url(#${uid}-hair)`} />
              {/* LED signature: a recess, the blade, a warm core */}
              <path d={g.lampRecess} fill="#080b0f" fillOpacity="0.85" filter={`url(#${uid}-hair)`} />
              <path d={g.lampBar} fill={`url(#${uid}-led)`} />
              <path d={g.lampCore} fill="none" stroke="#fff4e0" strokeOpacity="0.95" strokeWidth="1.6" filter={`url(#${uid}-hair)`} />
              <path d={g.lampBar} fill="none" stroke="#05070a" strokeOpacity="0.45" strokeWidth="0.8" />
              <path d={g.lampBar} fill="#ffffff" fillOpacity="0.3" filter={`url(#${uid}-mid)`} />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}
