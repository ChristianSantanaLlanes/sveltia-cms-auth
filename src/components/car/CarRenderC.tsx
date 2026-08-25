import { useId, type ReactElement } from 'react';
import type { BodyStyle, PaintOption, WheelOption } from '@/types';
import { Wheel, RimDefs, tyreRadius } from './rims';
import './CarRender.css';

export interface CarRenderCProps {
  body: BodyStyle;
  paint: PaintOption;
  wheel: WheelOption;
  view?: 'front-3q' | 'side';
  ground?: boolean;
  className?: string;
  label?: string;
}

type View = NonNullable<CarRenderCProps['view']>;
type Pt = [number, number];

/**
 * A point on the car body.
 *
 *  X  along the car, 0 at the centreline nose, growing to the tail
 *  Y  up from the floor
 *  k  lateral wrap: 1 = the widest point of the body, 0 = the centreline. The
 *     profile is a 3-D curve, so the nose and tail tuck inboard instead of
 *     ending in a slab, and the greenhouse narrows above the shoulder.
 *  dx how much further the centreline reaches than this point — used only by
 *     the orthographic side elevation, where the silhouette is the centreline.
 *
 * All lengths are in body modules (U). One module is the unit the proportion
 * sheet is written in: sedan length 4.6U, wheelbase 2.9U, roof 1.42U.
 */
type Node = [number, number, number, number?];

const VIEW_W = 1200;
const VIEW_H = 420;

/** Where the car is allowed to land inside the viewBox. */
const FIT = { x0: 62, x1: 1138, y0: 24, y1: 348 };

/* ── Path helpers ───────────────────────────────────────────────────────── */

function fmt(pt: Pt): string {
  return `${pt[0].toFixed(1)},${pt[1].toFixed(1)}`;
}

/** Catmull-Rom through every point — the continuous line a car body has. */
function curve(pts: Pt[], close = false): string {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i: number): Pt => (close ? pts[(i + n) % n] : pts[Math.min(n - 1, Math.max(0, i))]);
  let d = `M ${fmt(pts[0])}`;
  const segments = close ? n : n - 1;
  for (let i = 0; i < segments; i += 1) {
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

/** A closed panel bounded by two curved edges — never a straight-sided box. */
function strip(a: Pt[], b: Pt[]): string {
  return `${curve(a)} ${curve(b).replace(/^M/, 'L')} Z`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* ── The vehicles ───────────────────────────────────────────────────────── */

interface Spec {
  /** Plan half-width against X — the taper that rounds the nose and tail. */
  plan: Pt[];
  /** Nose → over the roof → tail, as the near-side silhouette. */
  upper: Node[];
  /** Tail → nose along the underside, minus the two wheel arches. */
  lower: Node[];
  /** Rocker points that sit between the arches. */
  rocker: Node[];
  frontAxle: number;
  rearAxle: number;
  /** Tyre radius in body modules. */
  tyre: number;
  /** Arch clearance over the tyre. */
  archGap: number;
  archRx: number;
  /** How far the tyre sits inboard of the widest body point. */
  inset: number;
  beltY: number;
  rockerY: number;
  floorY: number;
  /** Panel node indices: hood front, cowl, screen top, roof rear, backlight base, deck. */
  idx: { hoodF: number; cowl: number; wsTop: number; roofR: number; blBase: number; deck: number };
  /** Side glass, split at the B-pillar. */
  glassF: Pt[];
  glassR: Pt[];
  glassK: number;
  /** Character line down the flank. */
  shoulder: Pt[];
  doorCuts: number[];
  handles: Pt[];
  mirror: { x: number; y: number };
  /** Headlamp blade: leading node and its trailing node on the fender. */
  lamp: { top: Node; bot: Node; fender: Pt[] };
  tailLamp: Pt[];
  intake: { y: [number, number]; t: number };
  eye: number;
}

const SEDAN: Spec = {
  plan: [
    [0.0, 0.5],
    [0.18, 0.71],
    [0.42, 0.848],
    [0.92, 0.888],
    [1.6, 0.9],
    [3.0, 0.9],
    [3.7, 0.886],
    [4.2, 0.846],
    [4.5, 0.78],
    [4.72, 0.64],
  ],
  upper: [
    [0.2, 0.46, 0.52, -0.2],
    [0.23, 0.65, 0.58, -0.21],
    [0.3, 0.79, 0.66, -0.18],
    [0.44, 0.848, 0.78, -0.14],
    [0.74, 0.866, 0.92, -0.03],
    [1.06, 0.892, 0.98, 0],
    [1.35, 0.94, 1.0, 0],
    [1.63, 1.09, 0.99, 0],
    [1.96, 1.276, 0.93, 0],
    [2.3, 1.388, 0.85, 0],
    [2.72, 1.414, 0.8, 0],
    [3.08, 1.404, 0.8, 0],
    [3.42, 1.328, 0.86, 0],
    [3.8, 1.15, 0.94, 0],
    [4.08, 1.05, 0.99, 0],
    [4.38, 1.018, 1.0, 0.04],
    [4.54, 0.985, 0.96, 0.07],
    [4.62, 0.86, 0.88, 0.09],
    [4.62, 0.6, 0.8, 0.09],
  ],
  lower: [
    [4.58, 0.42, 0.76, 0.08],
    [4.52, 0.3, 0.88, 0.05],
    [4.24, 0.262, 1.0, 0],
  ],
  rocker: [
    [3.12, 0.298, 1.0],
    [2.5, 0.29, 1.0],
    [1.9, 0.298, 1.0],
  ],
  frontAxle: 0.65,
  rearAxle: 3.55,
  tyre: 0.372,
  archGap: 0.046,
  archRx: 0.455,
  inset: 0.07,
  beltY: 0.95,
  rockerY: 0.3,
  floorY: 0.16,
  idx: { hoodF: 3, cowl: 6, wsTop: 9, roofR: 11, blBase: 13, deck: 15 },
  glassF: [
    [1.74, 1.005],
    [2.02, 1.222],
    [2.35, 1.348],
    [2.63, 1.346],
    [2.63, 0.968],
    [1.9, 0.955],
  ],
  glassR: [
    [2.71, 1.346],
    [3.04, 1.34],
    [3.36, 1.268],
    [3.64, 1.112],
    [3.2, 0.985],
    [2.71, 0.972],
  ],
  glassK: 0.9,
  shoulder: [
    [0.5, 0.792],
    [1.14, 0.802],
    [2.0, 0.818],
    [2.95, 0.836],
    [3.86, 0.856],
    [4.46, 0.876],
  ],
  doorCuts: [1.8, 2.66, 3.68],
  handles: [
    [2.32, 0.888],
    [3.22, 0.902],
  ],
  mirror: { x: 1.72, y: 1.03 },
  lamp: {
    top: [0.4, 0.826, 0.755, -0.135],
    bot: [0.355, 0.778, 0.705, -0.15],
    fender: [
      [0.4, 0.826],
      [0.62, 0.836],
      [0.72, 0.83],
      [0.72, 0.804],
      [0.6, 0.802],
      [0.4, 0.784],
    ],
  },
  tailLamp: [
    [4.24, 1.02],
    [4.48, 1.032],
    [4.62, 1.0],
    [4.62, 0.958],
    [4.48, 0.986],
    [4.24, 0.976],
  ],
  intake: { y: [0.305, 0.44], t: 0.82 },
  eye: 1.38,
};

const SUV: Spec = {
  plan: [
    [0.0, 0.52],
    [0.2, 0.73],
    [0.46, 0.862],
    [0.98, 0.9],
    [1.6, 0.91],
    [3.2, 0.91],
    [3.9, 0.9],
    [4.3, 0.868],
    [4.55, 0.8],
    [4.72, 0.66],
  ],
  upper: [
    [0.22, 0.54, 0.52, -0.21],
    [0.26, 0.75, 0.58, -0.22],
    [0.34, 0.93, 0.66, -0.19],
    [0.5, 1.005, 0.8, -0.15],
    [0.82, 1.028, 0.92, -0.04],
    [1.16, 1.058, 0.98, 0],
    [1.42, 1.11, 1.0, 0],
    [1.7, 1.31, 0.99, 0],
    [2.02, 1.51, 0.94, 0],
    [2.36, 1.668, 0.88, 0],
    [2.9, 1.716, 0.84, 0],
    [3.46, 1.706, 0.84, 0],
    [3.88, 1.668, 0.88, 0],
    [4.1, 1.52, 0.94, 0],
    [4.34, 1.29, 0.99, 0],
    [4.47, 1.06, 1.0, 0.06],
    [4.52, 0.82, 0.94, 0.08],
    [4.51, 0.6, 0.86, 0.07],
    [4.46, 0.46, 0.8, 0.06],
  ],
  lower: [
    [4.42, 0.4, 0.78, 0.06],
    [4.36, 0.38, 0.9, 0.04],
    [4.16, 0.342, 1.0, 0],
  ],
  rocker: [
    [3.06, 0.378, 1.0],
    [2.44, 0.37, 1.0],
    [1.86, 0.378, 1.0],
  ],
  frontAxle: 0.68,
  rearAxle: 3.53,
  tyre: 0.415,
  archGap: 0.05,
  archRx: 0.5,
  inset: 0.07,
  beltY: 1.1,
  rockerY: 0.38,
  floorY: 0.22,
  idx: { hoodF: 3, cowl: 6, wsTop: 9, roofR: 11, blBase: 13, deck: 15 },
  glassF: [
    [1.8, 1.16],
    [2.08, 1.4],
    [2.4, 1.612],
    [2.66, 1.616],
    [2.66, 1.122],
    [1.96, 1.108],
  ],
  glassR: [
    [2.74, 1.616],
    [3.22, 1.614],
    [3.62, 1.586],
    [3.94, 1.53],
    [3.5, 1.16],
    [2.74, 1.13],
  ],
  glassK: 0.9,
  shoulder: [
    [0.56, 0.938],
    [1.2, 0.95],
    [2.06, 0.968],
    [3.0, 0.988],
    [3.9, 1.008],
    [4.42, 1.024],
  ],
  doorCuts: [1.88, 2.7, 3.86],
  handles: [
    [2.36, 1.042],
    [3.3, 1.058],
  ],
  mirror: { x: 1.8, y: 1.2 },
  lamp: {
    top: [0.46, 0.982, 0.775, -0.145],
    bot: [0.415, 0.928, 0.725, -0.16],
    fender: [
      [0.46, 0.982],
      [0.68, 0.994],
      [0.78, 0.988],
      [0.78, 0.958],
      [0.66, 0.956],
      [0.46, 0.934],
    ],
  },
  tailLamp: [
    [4.16, 1.19],
    [4.4, 1.204],
    [4.52, 1.172],
    [4.52, 1.128],
    [4.4, 1.156],
    [4.16, 1.144],
  ],
  intake: { y: [0.385, 0.55], t: 0.84 },
  eye: 1.66,
};

const SPECS: Record<BodyStyle, Spec> = { sedan: SEDAN, suv: SUV };

/* ── Camera ─────────────────────────────────────────────────────────────── */

/**
 * front-3q: 32° of yaw, the lens a shade above the beltline, and a long lens —
 * the far flank comes back ~8% shorter and the far wheel ~9% smaller, which is
 * all the perspective a product plate should ever show.
 * side: a true orthographic elevation. Both wheels the same size, no taper.
 */
interface Rig {
  yaw: number;
  dist: number;
}

const RIGS: Record<View, Rig> = {
  'front-3q': { yaw: 32, dist: 15 },
  side: { yaw: 0, dist: 1e7 },
};

function planAt(plan: Pt[], x: number): number {
  if (x <= plan[0][0]) return plan[0][1];
  for (let i = 1; i < plan.length; i += 1) {
    if (x <= plan[i][0]) {
      const [x0, h0] = plan[i - 1];
      const [x1, h1] = plan[i];
      return lerp(h0, h1, (x - x0) / (x1 - x0));
    }
  }
  return plan[plan.length - 1][1];
}

interface Projector {
  raw: (X: number, Y: number, Z: number) => Pt;
  /** A body node, on the near (-1) or far (+1) flank. */
  n: (node: Node, side?: number) => Pt;
  /** A flat [X, Y] point on a given flank. */
  f: (pt: Pt, k: number, side?: number) => Pt;
  /** A cross-car contour through a node, near corner → far corner. */
  contour: (node: Node, t0?: number, t1?: number, samples?: number) => Pt[];
  q3: boolean;
}

function projector(spec: Spec, view: View, s: number, ox: number, oy: number): Projector {
  const rig = RIGS[view];
  const q3 = view === 'front-3q';
  const a = (rig.yaw * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const L = spec.upper[spec.upper.length - 1][0];
  const uRef = (L / 2) * ca;
  const wRef = (L / 2) * sa;

  /* A pinhole at eye height looking level down the studio: everything
     converges on one horizon, so the ground line rises toward the tail while
     the roofline drops toward it — the car never tips as a whole. */
  const raw = (X: number, Y: number, Z: number): Pt => {
    const u = X * ca - Z * sa;
    const w = X * sa + Z * ca;
    const f = rig.dist / (rig.dist + w - wRef);
    return [ox + s * f * (u - uRef), oy + s * f * (spec.eye - Y)];
  };

  const n = (node: Node, side = -1): Pt =>
    q3
      ? raw(node[0], node[1], side * planAt(spec.plan, node[0]) * node[2])
      : raw(node[0] + (node[3] ?? 0), node[1], 0);

  const f = (pt: Pt, k: number, side = -1): Pt =>
    q3 ? raw(pt[0], pt[1], side * planAt(spec.plan, pt[0]) * k) : raw(pt[0], pt[1], 0);

  const contour = (node: Node, t0 = -1, t1 = 1, samples = 13): Pt[] => {
    const zMax = planAt(spec.plan, node[0]) * node[2];
    const bulge = -(node[3] ?? 0);
    return Array.from({ length: samples }, (_, i) => {
      const t = lerp(t0, t1, i / (samples - 1));
      return raw(node[0] - bulge * (1 - t * t), node[1], t * zMax);
    });
  };

  return { raw, n, f, contour, q3 };
}

/* ── Geometry ───────────────────────────────────────────────────────────── */

/** Half an arch, sampled from the trailing side over the tyre to the leading side. */
function archNodes(cx: number, rx: number, ry: number, cy: number, rockerY: number): Node[] {
  const dip = Math.asin(Math.min(0.98, (cy - rockerY) / ry));
  return Array.from({ length: 15 }, (_, i) => {
    const t = lerp(-dip, Math.PI + dip, i / 14);
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t), 0.985] as Node;
  }).reverse();
}

interface WheelPlace {
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  by: number;
  shade: number;
  far: boolean;
  gx: number;
  gz: number;
}

function build(spec: Spec, view: View, size: number, s: number, ox: number, oy: number) {
  const P = projector(spec, view, s, ox, oy);
  const q3 = P.q3;
  const R = spec.tyre * (tyreRadius(size) / 0.3468);
  const archRy = R + spec.archGap;
  const L = spec.upper[spec.upper.length - 1][0];
  const idx = spec.idx;

  const frontArch = archNodes(spec.frontAxle, spec.archRx, archRy, R, spec.rockerY);
  const rearArch = archNodes(spec.rearAxle, spec.archRx, archRy, R, spec.rockerY);

  /* One closed silhouette: over the roof, down the tail, through both arches. */
  const loop: Node[] = [...spec.upper, ...spec.lower, ...rearArch, ...spec.rocker, ...frontArch];
  const near = (nodes: Node[], side = -1) => nodes.map((nd) => P.n(nd, side));
  const outline = curve(near(loop), true);

  const chain = (i0: number, i1: number, side = -1): Pt[] => {
    const out: Pt[] = [];
    const step = i0 <= i1 ? 1 : -1;
    for (let i = i0; step > 0 ? i <= i1 : i >= i1; i += step) out.push(P.n(spec.upper[i], side));
    return out;
  };

  const panel = (i0: number, i1: number, lead?: Pt[]) =>
    strip(lead ? [...lead, ...chain(i0 + 1, i1, 1)] : chain(i0, i1, 1), chain(i1, i0, -1));

  const hoodLead = P.contour(spec.upper[idx.hoodF]);
  const hood = panel(idx.hoodF, idx.cowl, hoodLead);
  const windscreen = panel(idx.cowl, idx.wsTop);
  const roof = panel(idx.wsTop, idx.roofR);
  const backlight = panel(idx.roofR, idx.blBase);
  const deck = panel(idx.blBase, idx.deck);

  /* Front fascia: the nose profile swept across the car, bulging at the centre
     so the leading edge is a curve in plan, not a flat wall. */
  const frontLower = frontArch[frontArch.length - 1];
  const noseChain: Node[] = [spec.upper[3], spec.upper[2], spec.upper[1], spec.upper[0], frontLower];
  const face = strip(
    [...hoodLead, ...near(noseChain.slice(1), 1)],
    near([...noseChain].reverse().slice(1), -1)
  );
  const faceLip = curve(P.contour(frontLower, -0.9, 0.9));

  const intakeTop: Node = [
    lerp(frontLower[0], spec.upper[0][0], 0.35),
    spec.intake.y[1],
    lerp(frontLower[2], spec.upper[0][2], 0.35),
    lerp(frontLower[3] ?? 0, spec.upper[0][3] ?? 0, 0.35),
  ];
  const intakeBot: Node = [frontLower[0] + 0.02, spec.intake.y[0], frontLower[2] * 0.97, (frontLower[3] ?? 0) * 0.9];
  const intake = strip(
    P.contour(intakeTop, -spec.intake.t, spec.intake.t),
    P.contour(intakeBot, spec.intake.t, -spec.intake.t)
  );

  /* Headlamp: one slim blade across the fascia that wraps onto the fender. */
  const lampBlade = strip(
    P.contour(spec.lamp.top, -0.97, 0.97),
    P.contour(spec.lamp.bot, 0.97, -0.97)
  );
  const lampFender = curve(spec.lamp.fender.map((pt) => P.f(pt, 1)), true);

  const glassF = curve(spec.glassF.map((pt) => P.f(pt, spec.glassK)), true);
  const glassR = curve(spec.glassR.map((pt) => P.f(pt, spec.glassK)), true);

  /* The greenhouse mass behind the glass: pillars and window frames. */
  const beltK = spec.glassK + 0.05;
  const canopy = strip(chain(idx.cowl, idx.blBase, -1), [
    P.f([spec.glassR[3][0] + 0.03, spec.beltY + 0.02], beltK),
    P.f([3.0, spec.beltY - 0.005], beltK),
    P.f([2.2, spec.beltY - 0.005], beltK),
    P.f([spec.upper[idx.cowl][0] + 0.04, spec.beltY - 0.01], beltK),
  ]);

  /* Shading ribbons — every one of them follows the panel, never a straight
     rule across the door. */
  const ribbon = (pts: Pt[], up: number, down: number, k = 1) =>
    strip(
      pts.map(([x, y]) => P.f([x, y + up], k)),
      [...pts].reverse().map(([x, y]) => P.f([x, y - down], k))
    );

  const shoulderPath = curve(spec.shoulder.map((pt) => P.f(pt, 1)));
  const shoulderGlow = ribbon(spec.shoulder, 0.055, 0.012);
  const shoulderDark = ribbon(
    spec.shoulder.map(([x, y]) => [x, y - 0.05] as Pt),
    0.035,
    0.075
  );

  const horizon: Pt[] = spec.shoulder.map(([x, y], i) => [x, y - (0.2 + 0.03 * i)] as Pt);
  const horizonBand = ribbon(horizon, 0.075, 0.075);

  const sillPts: Pt[] = [
    [spec.frontAxle + 0.42, spec.rockerY + 0.055],
    [(spec.frontAxle + spec.rearAxle) / 2, spec.rockerY + 0.048],
    [spec.rearAxle - 0.42, spec.rockerY + 0.058],
  ];
  const sillBounce = curve(sillPts.map((pt) => P.f(pt, 1)));
  const sillShade = ribbon(
    sillPts.map(([x, y]) => [x, y - 0.03] as Pt),
    0.018,
    0.05
  );

  /* Panel gaps, as hairlines. */
  const doorCuts = spec.doorCuts.map((x) => {
    const top = x > spec.glassF[0][0] && x < spec.glassR[3][0] ? spec.beltY + 0.005 : spec.beltY - 0.02;
    return curve([
      P.f([x, spec.rockerY + 0.015], 1),
      P.f([x - 0.012, lerp(spec.rockerY, top, 0.55)], 1),
      P.f([x - 0.018, top], 1),
    ]);
  });
  const hoodCut = curve([
    P.f([spec.upper[idx.cowl][0] - 0.02, spec.upper[idx.cowl][1] - 0.02], 1),
    P.f([spec.upper[idx.cowl][0] + 0.01, lerp(spec.beltY, spec.rockerY, 0.45)], 1),
    P.f([spec.upper[idx.cowl][0] + 0.05, spec.rockerY + 0.16], 1),
  ]);
  const deckCut = curve([
    P.f([spec.glassR[3][0] + 0.04, spec.beltY + 0.03], 0.98),
    P.f([spec.glassR[3][0] + 0.08, lerp(spec.beltY, spec.rockerY, 0.5)], 1),
    P.f([spec.glassR[3][0] + 0.12, spec.rockerY + 0.14], 1),
  ]);

  const handles = spec.handles.map(([x, y]) =>
    strip(
      [P.f([x - 0.13, y + 0.006], 1), P.f([x, y + 0.012], 1), P.f([x + 0.13, y + 0.008], 1)],
      [P.f([x + 0.13, y - 0.026], 1), P.f([x, y - 0.024], 1), P.f([x - 0.13, y - 0.03], 1)]
    )
  );

  const mirrorAt = (side: number) => {
    const m = spec.mirror;
    const out = 0.2 * side;
    const zk = (planAt(spec.plan, m.x) + Math.abs(out)) / planAt(spec.plan, m.x);
    const pts: Pt[] = [
      [m.x - 0.02, m.y - 0.01],
      [m.x + 0.08, m.y + 0.012],
      [m.x + 0.19, m.y - 0.008],
      [m.x + 0.17, m.y - 0.085],
      [m.x + 0.05, m.y - 0.1],
      [m.x - 0.03, m.y - 0.06],
    ];
    return curve(pts.map((pt) => P.f(pt, zk, side)), true);
  };

  const tailLamp = curve(spec.tailLamp.map((pt) => P.f(pt, 1)), true);

  const archLip = (cx: number) =>
    curve(
      Array.from({ length: 21 }, (_, i) => {
        const t = lerp(-0.12, Math.PI + 0.12, i / 20);
        return P.f([cx + (spec.archRx + 0.03) * Math.cos(t), R + (archRy + 0.03) * Math.sin(t)] as Pt, 0.99);
      })
    );
  const archPocket = (cx: number) =>
    curve(
      Array.from({ length: 21 }, (_, i) => {
        const t = lerp(-0.3, Math.PI + 0.3, i / 20);
        return P.f([cx + spec.archRx * Math.cos(t), R + archRy * Math.sin(t)] as Pt, 0.9);
      }),
      true
    );

  /* Everything under the sill is one dark mass that tucks in at the floor, so
     it can never read as a slab the car is parked on. */
  const underPts: Pt[] = [
    [spec.rearAxle + 0.62, spec.rockerY - 0.02],
    [spec.rearAxle, spec.rockerY + 0.02],
    [(spec.frontAxle + spec.rearAxle) / 2, spec.rockerY - 0.01],
    [spec.frontAxle, spec.rockerY + 0.02],
    [spec.frontAxle - 0.42, spec.rockerY - 0.03],
    [spec.frontAxle - 0.42, spec.floorY + 0.02],
    [(spec.frontAxle + spec.rearAxle) / 2, spec.floorY - 0.02],
    [spec.rearAxle + 0.5, spec.floorY + 0.04],
  ];
  const under = curve(underPts.map((pt) => P.f(pt, 0.94)), true);

  const wipers = strip(
    [P.n(spec.upper[idx.cowl], -0.55), P.n(spec.upper[idx.cowl], 0.1), P.n(spec.upper[idx.cowl], 0.6)],
    [
      P.raw(spec.upper[idx.cowl][0] + 0.09, spec.upper[idx.cowl][1] + 0.028, 0.6 * planAt(spec.plan, spec.upper[idx.cowl][0])),
      P.raw(spec.upper[idx.cowl][0] + 0.09, spec.upper[idx.cowl][1] + 0.03, 0.1),
      P.raw(spec.upper[idx.cowl][0] + 0.09, spec.upper[idx.cowl][1] + 0.028, -0.55 * planAt(spec.plan, spec.upper[idx.cowl][0])),
    ]
  );

  /* Wheels. The projector supplies the matrix, so a wheel is never a hand-made
     ellipse: the near pair sit at the widest point, the far one 9% smaller. */
  const place = (X: number, side: number, shade: number, far: boolean): WheelPlace => {
    const gz = side * (planAt(spec.plan, X) - spec.inset);
    const z = q3 ? gz : 0;
    const c = P.raw(X, R, z);
    const along = P.raw(X + R, R, z);
    const down = P.raw(X, 0, z);
    return {
      cx: c[0],
      cy: c[1],
      ax: along[0] - c[0],
      ay: along[1] - c[1],
      by: down[1] - c[1],
      shade,
      far,
      gx: X,
      gz: q3 ? gz : 0,
    };
  };
  const wheels: WheelPlace[] = [];
  if (q3) wheels.push(place(spec.frontAxle, 1, 0.5, true));
  wheels.push(place(spec.rearAxle, -1, q3 ? 0.1 : 0.05, false));
  wheels.push(place(spec.frontAxle, -1, 0, false));

  /* Ground plane basis, for shadows that lie on the floor. */
  const gO = P.raw(L / 2, 0, 0);
  const gX = P.raw(L / 2 + 1, 0, 0);
  const gZ = P.raw(L / 2, 0, 1);
  const groundM = `matrix(${(gX[0] - gO[0]).toFixed(3)} ${(gX[1] - gO[1]).toFixed(3)} ${(gZ[0] - gO[0]).toFixed(
    3
  )} ${(gZ[1] - gO[1]).toFixed(3)} ${gO[0].toFixed(2)} ${gO[1].toFixed(2)})`;

  /* Gradient axes, measured on the car so they stay square to its panels. */
  const midX = (spec.frontAxle + spec.rearAxle) / 2;
  const axis = (y0: number, y1: number, k = 1): [Pt, Pt] => [P.f([midX, y0], k), P.f([midX, y1], k)];
  const along = (y: number): [Pt, Pt] => [P.f([0.1, y], 0.9), P.f([L, y], 0.9)];

  return {
    outline,
    hood,
    hoodLead: curve(hoodLead),
    windscreen,
    roof,
    backlight,
    deck,
    face,
    faceLip,
    intake,
    lampBlade,
    lampFender,
    glassF,
    glassR,
    canopy,
    shoulderPath,
    shoulderGlow,
    shoulderDark,
    horizonBand,
    sillBounce,
    sillShade,
    doorCuts,
    hoodCut,
    deckCut,
    handles,
    mirrorNear: mirrorAt(-1),
    mirrorFar: mirrorAt(1),
    tailLamp,
    archLips: [archLip(spec.frontAxle), archLip(spec.rearAxle)],
    archPockets: [archPocket(spec.frontAxle), archPocket(spec.rearAxle)],
    under,
    wipers,
    wheels,
    groundM,
    R,
    L,
    flankAxis: axis(spec.beltY + 0.02, spec.rockerY - 0.02),
    topAxis: axis(spec.upper[idx.roofR][1] + 0.05, spec.beltY - 0.1, 0.3),
    glassAxis: axis(spec.upper[idx.wsTop][1] + 0.02, spec.beltY - 0.04, 0.6),
    faceAxis: [P.raw(0, spec.upper[3][1] + 0.04, 0), P.raw(0, spec.rockerY - 0.06, 0)] as [Pt, Pt],
    alongAxis: along(spec.beltY),
    groundY: Math.max(...wheels.filter((w) => !w.far).map((w) => w.cy + w.by)),
  };
}

type Geometry = ReturnType<typeof build>;

/** Fit the car into the frame: measure it at unit scale, then place it. */
function fitted(spec: Spec, view: View, size: number): Geometry {
  const probe = build(spec, view, size, 1, 0, 0);
  const pts: Pt[] = [];
  const P = projector(spec, view, 1, 0, 0);
  const all: Node[] = [...spec.upper, ...spec.lower, ...spec.rocker];
  all.forEach((nd) => {
    pts.push(P.n(nd, -1));
    if (view === 'front-3q') pts.push(P.n(nd, 1));
  });
  probe.wheels.forEach((w) => {
    pts.push([w.cx - Math.abs(w.ax), w.cy + w.by]);
    pts.push([w.cx + Math.abs(w.ax), w.cy + w.by]);
  });
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const s = Math.min((FIT.x1 - FIT.x0) / (x1 - x0), (FIT.y1 - FIT.y0) / (y1 - y0));
  const ox = FIT.x0 - s * x0 + (FIT.x1 - FIT.x0 - s * (x1 - x0)) / 2;
  const oy = FIT.y1 - s * y1;
  return build(spec, view, size, s, ox, oy);
}

function describe(body: BodyStyle, paint: PaintOption, wheel: WheelOption, view: View): string {
  const shape = body === 'suv' ? 'SUV' : 'sedan';
  const angle = view === 'side' ? 'side profile' : 'front three-quarter view';
  return `Vela ${shape} in ${paint.name} with ${wheel.name}, ${angle}`;
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function CarRenderC({
  body,
  paint,
  wheel,
  view = 'front-3q',
  ground = true,
  className,
  label,
}: CarRenderCProps): ReactElement {
  const uid = `c${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const spec = SPECS[body] ?? SEDAN;
  const g = fitted(spec, view, wheel.size);
  const q3 = view === 'front-3q';
  const id = (n: string) => `${uid}-${n}`;
  const u = (n: string) => `url(#${uid}-${n})`;
  const [fa, fb] = g.flankAxis;
  const [ta, tb] = g.topAxis;
  const [ga, gb] = g.glassAxis;
  const [ca, cb] = g.faceAxis;
  const [aa, ab] = g.alongAxis;
  const gy = g.groundY;
  const fade = Math.abs(g.wheels[g.wheels.length - 1].by) * 1.15;

  return (
    <svg
      className={className ? `car-render ${className}` : 'car-render'}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label ?? describe(body, paint, wheel, view)}
    >
      <defs>
        {/* The flank is a mirror: sky along the shoulder, a hard turn under the
            character line, then the studio floor darkening downward, with a
            lick of bounce right at the sill. */}
        <linearGradient id={id('flank')} gradientUnits="userSpaceOnUse" x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]}>
          <stop offset="0" stopColor={paint.sheen} data-paint />
          <stop offset="0.1" stopColor={paint.hex} data-paint />
          <stop offset="0.34" stopColor={paint.hex} data-paint />
          <stop offset="0.72" stopColor={paint.shade} data-paint />
          <stop offset="0.9" stopColor={paint.shade} data-paint />
          <stop offset="1" stopColor={paint.hex} data-paint />
        </linearGradient>
        {/* Upward-facing panels see the softbox: light, and very soft. */}
        <linearGradient id={id('top')} gradientUnits="userSpaceOnUse" x1={ta[0]} y1={ta[1]} x2={tb[0]} y2={tb[1]}>
          <stop offset="0" stopColor={paint.sheen} data-paint />
          <stop offset="0.55" stopColor={paint.hex} data-paint />
          <stop offset="1" stopColor={paint.hex} data-paint />
        </linearGradient>
        <linearGradient id={id('sky')} gradientUnits="userSpaceOnUse" x1={ta[0]} y1={ta[1]} x2={tb[0]} y2={tb[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={id('face')} gradientUnits="userSpaceOnUse" x1={ca[0]} y1={ca[1]} x2={cb[0]} y2={cb[1]}>
          <stop offset="0" stopColor={paint.sheen} data-paint />
          <stop offset="0.16" stopColor={paint.hex} data-paint />
          <stop offset="0.62" stopColor={paint.hex} data-paint />
          <stop offset="0.94" stopColor={paint.shade} data-paint />
          <stop offset="1" stopColor={paint.hex} data-paint />
        </linearGradient>

        {/* Reflections travel along the car, so they fade on its length. */}
        <linearGradient id={id('along')} gradientUnits="userSpaceOnUse" x1={aa[0]} y1={aa[1]} x2={ab[0]} y2={ab[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.16" stopColor="#ffffff" stopOpacity="0.62" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="0.86" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('horizon')} gradientUnits="userSpaceOnUse" x1={aa[0]} y1={aa[1]} x2={ab[0]} y2={ab[1]}>
          <stop offset="0" stopColor={paint.shade} stopOpacity="0" data-paint />
          <stop offset="0.22" stopColor={paint.shade} stopOpacity="0.5" data-paint />
          <stop offset="0.7" stopColor={paint.shade} stopOpacity="0.34" data-paint />
          <stop offset="1" stopColor={paint.shade} stopOpacity="0" data-paint />
        </linearGradient>
        <linearGradient id={id('bounce')} gradientUnits="userSpaceOnUse" x1={aa[0]} y1={aa[1]} x2={ab[0]} y2={ab[1]}>
          <stop offset="0" stopColor={paint.sheen} stopOpacity="0" data-paint />
          <stop offset="0.3" stopColor={paint.sheen} stopOpacity="0.4" data-paint />
          <stop offset="0.8" stopColor={paint.sheen} stopOpacity="0.24" data-paint />
          <stop offset="1" stopColor={paint.sheen} stopOpacity="0" data-paint />
        </linearGradient>
        <linearGradient id={id('under')} gradientUnits="userSpaceOnUse" x1={aa[0]} y1={aa[1]} x2={ab[0]} y2={ab[1]}>
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.14" stopColor="#000000" stopOpacity="0.55" />
          <stop offset="0.86" stopColor="#000000" stopOpacity="0.5" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </linearGradient>

        {/* Glass is never the paint colour: it carries its own blue-grey. */}
        <linearGradient id={id('glass')} gradientUnits="userSpaceOnUse" x1={ga[0]} y1={ga[1]} x2={gb[0]} y2={gb[1]}>
          <stop offset="0" stopColor="#5d6a78" />
          <stop offset="0.3" stopColor="#2c343d" />
          <stop offset="0.72" stopColor="#191f26" />
          <stop offset="1" stopColor="#0e1216" />
        </linearGradient>
        <linearGradient id={id('ws')} gradientUnits="userSpaceOnUse" x1={ta[0]} y1={ta[1]} x2={tb[0]} y2={tb[1]}>
          <stop offset="0" stopColor="#6c798a" />
          <stop offset="0.34" stopColor="#333c47" />
          <stop offset="0.78" stopColor="#1a2027" />
          <stop offset="1" stopColor="#11151a" />
        </linearGradient>

        <linearGradient id={id('led')} gradientUnits="userSpaceOnUse" x1={aa[0]} y1={aa[1]} x2={aa[0] + (ab[0] - aa[0]) * 0.22} y2={aa[1]}>
          <stop offset="0" stopColor="#f4f8ff" />
          <stop offset="0.4" stopColor="#ffffff" />
          <stop offset="0.72" stopColor="#cfe0f7" />
          <stop offset="1" stopColor="#8ea6c6" />
        </linearGradient>
        <linearGradient id={id('tail')} gradientUnits="userSpaceOnUse" x1={ab[0]} y1={ab[1]} x2={aa[0] + (ab[0] - aa[0]) * 0.8} y2={ab[1]}>
          <stop offset="0" stopColor="#ff6a52" />
          <stop offset="0.45" stopColor="#d8241d" />
          <stop offset="1" stopColor="#7e0d12" />
        </linearGradient>

        <radialGradient id={id('pool')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0a0d11" stopOpacity="0.4" />
          <stop offset="0.45" stopColor="#0a0d11" stopOpacity="0.2" />
          <stop offset="1" stopColor="#0a0d11" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('contact')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#05070a" stopOpacity="0.72" />
          <stop offset="0.55" stopColor="#05070a" stopOpacity="0.34" />
          <stop offset="1" stopColor="#05070a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('mirrorfade')} gradientUnits="userSpaceOnUse" x1="0" y1={gy} x2="0" y2={gy + fade}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <RimDefs uid={uid} />

        <filter id={id('pooler')} x="-40%" y="-260%" width="180%" height="620%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id={id('soft')} x="-40%" y="-260%" width="180%" height="620%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={id('tight')} x="-60%" y="-300%" width="220%" height="700%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={id('hair')} x="-60%" y="-300%" width="220%" height="700%">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>

        <clipPath id={id('clipflank')}>
          <path d={g.outline} />
        </clipPath>
        <clipPath id={id('clipface')}>
          <path d={g.face} />
        </clipPath>
        <clipPath id={id('clipws')}>
          <path d={g.windscreen} />
        </clipPath>
        <mask id={id('floor')}>
          <rect x="0" y={gy} width={VIEW_W} height={fade} fill={u('mirrorfade')} />
        </mask>
      </defs>

      {ground && (
        <g className="car-render__floor" mask={`url(#${uid}-floor)`} opacity="0.5">
          <use href={`#${uid}-car`} transform={`matrix(1 0 0 -0.6 0 ${(gy * 1.6).toFixed(1)})`} />
        </g>
      )}

      {ground && (
        <g className="car-render__shadow" transform={g.groundM}>
          <ellipse cx="0" cy="0" rx={g.L * 0.44} ry="0.95" fill={u('pool')} filter={u('pooler')} />
          {g.wheels.map((w) => (
            <ellipse
              key={`s${w.gx}${w.gz}`}
              cx={w.gx - g.L / 2}
              cy={w.gz}
              rx={g.R * 1.15}
              ry={g.R * 0.5}
              fill={u('contact')}
              filter={u('soft')}
            />
          ))}
        </g>
      )}

      <g id={`${uid}-car`}>
        {/* Wheel houses, then the wheels, then the body over them: the arch is a
            real opening in the silhouette, not a disc laid on the paint. */}
        {g.archPockets.map((d) => (
          <path key={d} d={d} fill="#06080b" />
        ))}
        <path d={g.under} fill={u('under')} filter={u('soft')} />

        {g.wheels.map((w) => (
          <Wheel
            key={`w${w.gx}${w.gz}`}
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

        {/* Upper surfaces first — the near flank lands on top of them and the
            two share an edge exactly, so no seam can open up. */}
        {q3 && (
          <>
            <g>
              <path d={g.deck} fill={u('top')} data-paint />
              <path d={g.deck} fill={u('sky')} />
              <path d={g.backlight} fill={u('ws')} />
              <path d={g.roof} fill={u('top')} data-paint />
              <path d={g.roof} fill={u('sky')} />
              <path d={g.windscreen} fill={u('ws')} />
              <g clipPath={`url(#${uid}-clipws)`}>
                <path d={g.wipers} fill="#0b0e12" fillOpacity="0.55" filter={u('hair')} />
                <path
                  d={g.roof}
                  fill="#ffffff"
                  fillOpacity="0.16"
                  transform={`translate(${(-g.R * 0.28).toFixed(1)} ${(g.R * 1.5).toFixed(1)})`}
                  filter={u('tight')}
                />
              </g>
              <path d={g.windscreen} fill="none" stroke="#0a0d11" strokeOpacity="0.45" strokeWidth="1.6" />
              <path d={g.hood} fill={u('top')} data-paint />
              <path d={g.hood} fill={u('sky')} />
              <path d={g.hoodLead} fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.6" />
            </g>
          </>
        )}

        {/* Near flank */}
        <path d={g.outline} fill={u('flank')} data-paint />
        <g clipPath={`url(#${uid}-clipflank)`}>
          <path d={g.horizonBand} fill={u('horizon')} filter={u('soft')} data-paint />
          <path d={g.sillShade} fill="#05070a" fillOpacity="0.42" filter={u('soft')} />
          <path d={g.shoulderDark} fill="#05070a" fillOpacity="0.3" filter={u('tight')} />
          <path d={g.shoulderGlow} fill={u('along')} filter={u('tight')} />
          <path d={g.shoulderPath} fill="none" stroke={u('along')} strokeWidth="1.4" />
          <path d={g.sillBounce} fill="none" stroke={u('bounce')} strokeWidth="4" filter={u('hair')} data-paint />
          {g.archLips.map((d) => (
            <path key={d} d={d} fill="none" stroke="#05070a" strokeOpacity="0.5" strokeWidth="9" filter={u('soft')} />
          ))}
          {g.archLips.map((d) => (
            <path key={`l${d}`} d={d} fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.2" />
          ))}
          <g fill="none" stroke="#05070a" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round">
            {g.doorCuts.map((d) => (
              <path key={d} d={d} />
            ))}
            <path d={g.hoodCut} strokeOpacity="0.2" />
            <path d={g.deckCut} strokeOpacity="0.2" />
          </g>
          {g.handles.map((d) => (
            <g key={d}>
              <path d={d} fill="#05070a" fillOpacity="0.3" />
              <path d={d} fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.9" transform="translate(0 -1)" />
            </g>
          ))}
          <path d={g.tailLamp} fill="#0b0e12" />
          <path d={g.tailLamp} fill={u('tail')} transform="translate(0 -0.8)" opacity="0.95" />
          <path d={g.tailLamp} fill="none" stroke="#07090c" strokeOpacity="0.55" strokeWidth="0.9" />
          {!q3 && (
            <>
              <path d={g.lampFender} fill="#0b0e12" />
              <path d={g.lampFender} fill={u('led')} transform="translate(0 -0.8)" />
            </>
          )}
        </g>

        {/* Glasshouse: frame first, then the two DLO panes. */}
        <path d={g.canopy} fill="#0e1216" />
        <path d={g.glassF} fill={u('glass')} />
        <path d={g.glassR} fill={u('glass')} />
        <g fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1">
          <path d={g.glassF} />
          <path d={g.glassR} />
        </g>

        {q3 && (
          <>
            <path d={g.mirrorFar} fill={paint.shade} data-paint />
            <path d={g.mirrorFar} fill="#05070a" fillOpacity="0.35" />
          </>
        )}
        <path d={g.mirrorNear} fill={u('flank')} data-paint />
        <path d={g.mirrorNear} fill="#05070a" fillOpacity="0.14" />

        {/* Front end — nearest to the lens, so it lands last. */}
        {q3 && (
          <>
            <path d={g.face} fill={u('face')} data-paint />
            <g clipPath={`url(#${uid}-clipface)`}>
              <path d={g.intake} fill="#0a0d11" fillOpacity="0.92" />
              <path d={g.intake} fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.4" transform="translate(0 -1.6)" />
              <path d={g.faceLip} fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="2.6" filter={u('hair')} />
              <path d={g.lampBlade} fill="#0a0d11" transform="translate(0 1.6)" />
              <path d={g.lampBlade} fill={u('led')} />
              <path d={g.lampBlade} fill="#ffffff" opacity="0.45" filter={u('hair')} />
              <path d={g.lampFender} fill={u('led')} />
              <path d={g.lampFender} fill="#ffffff" opacity="0.35" filter={u('hair')} />
            </g>
            <path d={g.face} fill="none" stroke="#05070a" strokeOpacity="0.16" strokeWidth="1" />
          </>
        )}
      </g>
    </svg>
  );
}
