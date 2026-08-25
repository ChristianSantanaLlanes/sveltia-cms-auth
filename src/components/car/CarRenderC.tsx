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
/** A point on the car in metres: [along the car from the nose, up from the floor]. */
type P2 = [number, number];

const VIEW_W = 1200;
const VIEW_H = 420;

/* ── Camera ───────────────────────────────────────────────────────────────
   Both drawings are axonometric projections of the same car, measured in
   metres, so nothing is hand-fudged: the three-quarter foreshortens the length
   by cos 25° and lifts the far side by the camera's 9° elevation. Wheels,
   arches, creases and light bars all inherit that transform, which is what
   makes the frame read as a photograph of a solid object.                   */

interface Cam {
  /** Pixels per metre. */
  s: number;
  yaw: number;
  elev: number;
  ox: number;
  oy: number;
}

const CAMS: Record<View, Cam> = {
  side: { s: 205, yaw: 0, elev: 0, ox: 116, oy: 340 },
  'front-3q': { s: 172, yaw: 25, elev: 9, ox: 299, oy: 354 },
};

interface Projector {
  /** X = nose → tail, Y = up from the floor, Z = near flank → far flank. */
  p: (X: number, Y: number, Z?: number) => Pt;
  kx: number;
  kxy: number;
  ky: number;
}

function projector(c: Cam): Projector {
  const a = (c.yaw * Math.PI) / 180;
  const e = (c.elev * Math.PI) / 180;
  const kx = c.s * Math.cos(a);
  const kz = -c.s * Math.sin(a);
  const ky = -c.s * Math.cos(e);
  const kxy = -c.s * Math.sin(e) * Math.sin(a);
  const kzy = -c.s * Math.sin(e) * Math.cos(a);
  return {
    kx,
    kxy,
    ky,
    p: (X, Y, Z = 0) => [c.ox + kx * X + kz * Z, c.oy + ky * Y + kxy * X + kzy * Z],
  };
}

/* ── Path helpers ─────────────────────────────────────────────────────────*/

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

function poly(pts: Pt[], close = true): string {
  return `M ${pts.map(fmt).join(' L ')}${close ? ' Z' : ''}`;
}

/* ── The vehicles, in metres ──────────────────────────────────────────────*/

interface Spec {
  width: number;
  /** Flank silhouette, front bumper → over the roof → rear bumper. */
  upper: P2[];
  rearLower: P2[];
  rocker: P2[];
  frontLower: P2[];
  arch: { rx: number; ry: number; cy: number; front: number; rear: number };
  /** Where the top surfaces begin and end along the car. */
  shell: { from: number; to: number };
  /** Half-width envelope of the top surfaces: [X, far-side Z]. */
  crown: P2[];
  /** How far the nose bulges forward at the centreline. */
  bulge: number;
  glassDlo: P2[];
  ws: { base: P2; top: P2; baseZ: [number, number]; topZ: [number, number] };
  roofPanel: { front: P2; rear: P2; z: [number, number] };
  hoodPanel: { front: P2; rear: P2; z: [number, number] };
  deckPanel: { front: P2; rear: P2; z: [number, number] };
  doors: number[];
  handles: P2[];
  shoulder: P2[];
  beltY: number;
  rockerY: number;
  darkBand: [number, number];
  bounceBand: [number, number];
  /** Light bar across the front fascia: [lower Y, upper Y]. */
  lampBar: [number, number];
  /** Headlamp as it wraps onto the near fender. */
  lampSide: P2[];
  tailSide: P2[];
  grille: { y: [number, number]; z: [number, number] };
  vent: { y: [number, number]; z: [number, number] };
  mirror: { x: number; y: number; w: number; h: number; out: number };
}

const SEDAN: Spec = {
  width: 1.85,
  upper: [
    [0.0, 0.46],
    [0.02, 0.68],
    [0.1, 0.865],
    [0.3, 0.95],
    [0.85, 0.985],
    [1.35, 1.015],
    [1.66, 1.05],
    [2.06, 1.27],
    [2.44, 1.412],
    [2.86, 1.438],
    [3.3, 1.414],
    [3.72, 1.3],
    [4.1, 1.14],
    [4.42, 1.088],
    [4.61, 1.038],
    [4.7, 0.9],
    [4.72, 0.66],
    [4.67, 0.45],
  ],
  rearLower: [
    [4.56, 0.31],
    [4.28, 0.278],
  ],
  rocker: [
    [3.1, 0.372],
    [2.4, 0.366],
    [1.8, 0.368],
  ],
  frontLower: [
    [0.36, 0.3],
    [0.14, 0.28],
    [0.02, 0.35],
  ],
  arch: { rx: 0.44, ry: 0.38, cy: 0.375, front: 0.87, rear: 3.745 },
  shell: { from: 0.3, to: 4.61 },
  crown: [
    [0.3, 1.7],
    [1.1, 1.76],
    [1.66, 1.64],
    [2.44, 1.53],
    [3.3, 1.53],
    [4.1, 1.65],
    [4.61, 1.7],
  ],
  bulge: 0.12,
  glassDlo: [
    [1.99, 1.078],
    [2.3, 1.293],
    [2.6, 1.388],
    [3.3, 1.388],
    [3.72, 1.272],
    [4.05, 1.138],
    [3.34, 1.09],
    [2.62, 1.08],
    [2.06, 1.075],
  ],
  ws: { base: [1.66, 1.05], top: [2.5, 1.409], baseZ: [0.2, 1.65], topZ: [0.34, 1.52] },
  roofPanel: { front: [2.5, 1.409], rear: [3.34, 1.4], z: [0.34, 1.52] },
  hoodPanel: { front: [0.3, 0.95], rear: [1.66, 1.05], z: [0.06, 1.7] },
  deckPanel: { front: [4.08, 1.145], rear: [4.61, 1.038], z: [0.16, 1.69] },
  doors: [1.88, 2.84, 3.68],
  handles: [
    [2.46, 0.995],
    [3.4, 1.012],
  ],
  shoulder: [
    [0.95, 0.895],
    [2.0, 0.925],
    [3.2, 0.952],
    [4.4, 0.978],
  ],
  beltY: 1.06,
  rockerY: 0.372,
  darkBand: [0.5, 0.73],
  bounceBand: [0.375, 0.46],
  lampBar: [0.845, 0.925],
  lampSide: [
    [0.05, 0.885],
    [0.24, 0.918],
    [0.44, 0.947],
    [0.45, 0.916],
    [0.26, 0.886],
    [0.06, 0.848],
  ],
  tailSide: [
    [4.36, 0.968],
    [4.58, 0.99],
    [4.72, 0.968],
    [4.72, 0.915],
    [4.58, 0.936],
    [4.36, 0.918],
  ],
  grille: { y: [0.32, 0.53], z: [0.28, 1.57] },
  vent: { y: [0.36, 0.66], z: [0.03, 0.24] },
  mirror: { x: 1.92, y: 1.045, w: 0.18, h: 0.075, out: 0.19 },
};

const SUV: Spec = {
  width: 1.92,
  upper: [
    [0.0, 0.52],
    [0.02, 0.76],
    [0.11, 0.975],
    [0.36, 1.055],
    [0.9, 1.085],
    [1.42, 1.115],
    [1.68, 1.145],
    [2.02, 1.38],
    [2.36, 1.562],
    [2.8, 1.606],
    [3.44, 1.6],
    [3.94, 1.556],
    [4.26, 1.49],
    [4.5, 1.39],
    [4.64, 1.23],
    [4.71, 1.0],
    [4.73, 0.74],
    [4.68, 0.52],
  ],
  rearLower: [
    [4.6, 0.38],
    [4.32, 0.348],
  ],
  rocker: [
    [3.2, 0.455],
    [2.4, 0.448],
    [1.8, 0.452],
  ],
  frontLower: [
    [0.42, 0.38],
    [0.16, 0.35],
    [0.03, 0.43],
  ],
  arch: { rx: 0.46, ry: 0.36, cy: 0.46, front: 0.9, rear: 3.79 },
  shell: { from: 0.36, to: 4.55 },
  crown: [
    [0.36, 1.76],
    [1.2, 1.82],
    [1.68, 1.7],
    [2.36, 1.58],
    [3.44, 1.58],
    [4.1, 1.68],
    [4.55, 1.76],
  ],
  bulge: 0.13,
  glassDlo: [
    [2.0, 1.175],
    [2.28, 1.398],
    [2.52, 1.54],
    [3.46, 1.536],
    [3.88, 1.492],
    [4.18, 1.408],
    [3.94, 1.235],
    [3.0, 1.19],
    [2.14, 1.175],
  ],
  ws: { base: [1.68, 1.145], top: [2.44, 1.555], baseZ: [0.2, 1.72], topZ: [0.34, 1.58] },
  roofPanel: { front: [2.44, 1.555], rear: [3.5, 1.549], z: [0.34, 1.58] },
  hoodPanel: { front: [0.36, 1.055], rear: [1.68, 1.145], z: [0.06, 1.76] },
  deckPanel: { front: [4.18, 1.408], rear: [4.55, 1.3], z: [0.2, 1.72] },
  doors: [1.9, 2.96, 3.86],
  handles: [
    [2.52, 1.11],
    [3.54, 1.122],
  ],
  shoulder: [
    [1.0, 0.985],
    [2.1, 1.015],
    [3.3, 1.045],
    [4.4, 1.07],
  ],
  beltY: 1.16,
  rockerY: 0.452,
  darkBand: [0.58, 0.84],
  bounceBand: [0.452, 0.55],
  lampBar: [0.95, 1.035],
  lampSide: [
    [0.06, 0.99],
    [0.26, 1.022],
    [0.48, 1.05],
    [0.49, 1.018],
    [0.28, 0.99],
    [0.07, 0.952],
  ],
  tailSide: [
    [4.34, 1.108],
    [4.58, 1.13],
    [4.73, 1.108],
    [4.73, 1.05],
    [4.58, 1.072],
    [4.34, 1.052],
  ],
  grille: { y: [0.4, 0.62], z: [0.3, 1.62] },
  vent: { y: [0.44, 0.76], z: [0.03, 0.26] },
  mirror: { x: 1.94, y: 1.14, w: 0.19, h: 0.078, out: 0.2 },
};

const SPECS: Record<BodyStyle, Spec> = { sedan: SEDAN, suv: SUV };

/* ── Derived geometry ─────────────────────────────────────────────────────*/

/** Half wheel-arch, sampled right-to-left so it arcs over the tyre. */
function archPts(cx: number, a: Spec['arch'], n = 12): P2[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * Math.PI;
    return [cx + a.rx * Math.cos(t), a.cy + a.ry * Math.sin(t)] as P2;
  });
}

function lerpCrown(crown: P2[], x: number): number {
  if (x <= crown[0][0]) return crown[0][1];
  for (let i = 1; i < crown.length; i += 1) {
    if (x <= crown[i][0]) {
      const [x0, z0] = crown[i - 1];
      const [x1, z1] = crown[i];
      return z0 + ((z1 - z0) * (x - x0)) / (x1 - x0);
    }
  }
  return crown[crown.length - 1][1];
}

interface Geometry {
  outline: string;
  shell: string;
  face: string;
  faceLip: string;
  under: string;
  underAxis: [Pt, Pt];
  hood: string;
  hoodCrown: string;
  roof: string;
  deck: string;
  windscreen: string;
  canopyEdge: string;
  sideGlass: string;
  pillar: string;
  archPockets: string[];
  archShadows: string[];
  doorCuts: string[];
  hoodCut: string;
  deckCut: string;
  handles: string[];
  shoulder: string;
  darkBand: string;
  bounceBand: string;
  skirt: string;
  beltLine: string;
  rockerLine: string;
  lampWrap: string;
  lampSide: string;
  lampGlow: string;
  grille: string;
  vents: string[];
  faceSplit: string;
  faceAxis: [Pt, Pt];
  tail: string;
  mirrorNear: string;
  mirrorFar: string;
  flankAxis: [Pt, Pt];
  topAxis: [Pt, Pt];
  glassAxis: [Pt, Pt];
  contact: { front: Pt; rear: Pt; angle: number };
  wheels: { cx: number; cy: number; far?: boolean; shade?: number }[];
  wheelAx: number;
  wheelAy: number;
  wheelBy: number;
  bounds: { x0: number; x1: number };
}

/** A gradient axis running square to the car's own length axis. */
function axisFrom(top: Pt, len: number, tilt: number): [Pt, Pt] {
  return [top, [top[0] + tilt * len, top[1] + len]];
}

function build(spec: Spec, view: View, wheelSize: number): Geometry {
  const { p, kx, kxy, ky } = projector(CAMS[view]);
  const W = spec.width;
  const R = tyreRadius(wheelSize);
  const q3 = view === 'front-3q';
  const line = (pts: P2[], z = 0) => curve(pts.map(([x, y]) => p(x, y, z)));
  const shape = (pts: P2[], z = 0) => curve(pts.map(([x, y]) => p(x, y, z)), true);

  /* Flank silhouette, as one closed loop. */
  const loop: P2[] = [
    ...spec.upper,
    ...spec.rearLower,
    ...archPts(spec.arch.rear, spec.arch),
    ...spec.rocker,
    ...archPts(spec.arch.front, spec.arch),
    ...spec.frontLower,
  ];
  const outline = curve(loop.map(([x, y]) => p(x, y)), true);

  /* Top surfaces: the flank profile swept out to the crown line. */
  const topProfile = spec.upper.filter(([x]) => x >= spec.shell.from - 0.001 && x <= spec.shell.to + 0.001);
  const shellNear = topProfile.map(([x, y]) => p(x, y));
  const shellFar = topProfile.map(([x, y]) => p(x, y, lerpCrown(spec.crown, x))).reverse();
  const shell = `${curve(shellNear)} ${curve(shellFar).replace('M', 'L')} Z`;

  /* Front fascia: the nose profile swept across the car, bulging at the centre. */
  const nose: P2[] = [...spec.frontLower.slice(-1), ...spec.upper.filter(([x]) => x <= spec.shell.from + 0.001)];
  const bulgeAt = (z: number) => spec.bulge * Math.sin((Math.PI * z) / W);
  /* The fascia is widest at the bumper and tucks in as it climbs to the hood
     line, so the far corner rounds off instead of ending in a beak. */
  const yLo = nose[0][1];
  const yHi = nose[nose.length - 1][1];
  const zFarAt = (y: number) =>
    W - 0.02 - (W - 0.02 - lerpCrown(spec.crown, spec.shell.from)) * Math.min(1, Math.max(0, (y - yLo) / (yHi - yLo)));
  const sweep = (y: number) =>
    Array.from({ length: 9 }, (_, i) => (i / 8) * zFarAt(y)).map((z) => [z, bulgeAt(z)] as Pt);
  const faceNear = nose.map(([x, y]) => p(x, y));
  const faceTop = sweep(yHi).map(([z, b]) => p(nose[nose.length - 1][0] - b, yHi, z));
  const faceFar = [...nose].reverse().map(([x, y]) => p(x, y, zFarAt(y)));
  const faceBottom = [...sweep(yLo)].reverse().map(([z, b]) => p(nose[0][0] - b, yLo, z));
  const face = curve([...faceNear, ...faceTop.slice(1), ...faceFar.slice(1), ...faceBottom.slice(1)], true);
  const faceLip = curve(sweep(yLo).map(([z, b]) => p(nose[0][0] - b, yLo + 0.03, z)));

  /* Everything under the sill reads as one dark mass. It follows the real
     lower silhouette and pulls in at the floor, so its ends stay tucked behind
     the bumpers and the tyres instead of squaring off into a slab. */
  const mid = (spec.arch.front + spec.arch.rear) / 2;
  const underTop: Pt[] = [
    p(spec.arch.rear + 0.72, spec.rockerY - 0.045),
    p(spec.arch.rear, spec.arch.cy),
    p(mid, spec.rockerY - 0.005),
    p(spec.arch.front, spec.arch.cy),
    p(spec.arch.front - 0.5, spec.rockerY - 0.055),
    p(0.07, spec.frontLower[2][1] - 0.015),
  ];
  const under = curve(
    [
      ...underTop,
      ...(q3 ? [p(0.05, spec.frontLower[2][1] - 0.02, W - 0.3), p(0.2, 0.09, W - 0.34)] : []),
      p(0.34, 0.05),
      p(spec.arch.front, -0.01),
      p(mid, -0.02),
      p(spec.arch.rear, -0.01),
      p(spec.arch.rear + 0.42, 0.1),
    ],
    true
  );
  const underAxis = axisFrom(p(mid, spec.rockerY), Math.abs(ky) * (spec.rockerY + 0.09), -kxy / kx);

  const panel = (a: P2, b: P2, z: [number, number]) =>
    poly([p(a[0], a[1], z[0]), p(b[0], b[1], z[0]), p(b[0], b[1], z[1]), p(a[0], a[1], z[1])]);

  /* The hood shares the fascia's bulged leading edge exactly, so the two never
     leave a sliver of paint sticking out past the nose. */
  const hood = curve(
    [
      ...sweep(yHi).map(([z, b]) => p(spec.hoodPanel.front[0] - b, spec.hoodPanel.front[1], z)),
      p(spec.hoodPanel.rear[0], spec.hoodPanel.rear[1], spec.hoodPanel.z[1]),
      p(spec.hoodPanel.rear[0], spec.hoodPanel.rear[1], spec.hoodPanel.z[0]),
    ],
    true
  );
  const hoodCrown = curve([
    p(spec.hoodPanel.front[0] - spec.bulge * 0.55, spec.hoodPanel.front[1] + 0.01, W * 0.34),
    p((spec.hoodPanel.front[0] + spec.hoodPanel.rear[0]) / 2, (spec.hoodPanel.front[1] + spec.hoodPanel.rear[1]) / 2 + 0.02, W * 0.36),
    p(spec.hoodPanel.rear[0] - 0.05, spec.hoodPanel.rear[1], W * 0.38),
  ]);
  const roof = panel(spec.roofPanel.front, spec.roofPanel.rear, spec.roofPanel.z);
  const deck = panel(spec.deckPanel.front, spec.deckPanel.rear, spec.deckPanel.z);

  const windscreen = poly([
    p(spec.ws.base[0], spec.ws.base[1], spec.ws.baseZ[0]),
    p(spec.ws.top[0], spec.ws.top[1], spec.ws.topZ[0]),
    p(spec.ws.top[0], spec.ws.top[1], spec.ws.topZ[1]),
    p(spec.ws.base[0], spec.ws.base[1], spec.ws.baseZ[1]),
  ]);
  /* Bright rail where the glass canopy turns over onto the far side. */
  const canopyEdge = poly(
    [
      p(spec.ws.base[0], spec.ws.base[1], spec.ws.baseZ[1]),
      p(spec.ws.top[0], spec.ws.top[1], spec.ws.topZ[1]),
      p(spec.roofPanel.rear[0], spec.roofPanel.rear[1], spec.roofPanel.z[1]),
    ],
    false
  );
  const glassZ = q3 ? 0.22 : 0;
  const sideGlass = shape(spec.glassDlo, glassZ);
  const pillar = poly([
    p(spec.ws.base[0], spec.ws.base[1], spec.ws.baseZ[0]),
    p(spec.ws.top[0], spec.ws.top[1], spec.ws.topZ[0]),
    p(spec.glassDlo[2][0], spec.glassDlo[2][1], glassZ),
    p(spec.glassDlo[0][0], spec.glassDlo[0][1], glassZ),
  ]);

  const archRing = (cx: number, grow: number) =>
    curve(
      Array.from({ length: 25 }, (_, i) => {
        const t = (i / 24) * Math.PI;
        return p(cx + (spec.arch.rx + grow) * Math.cos(t), spec.arch.cy + (spec.arch.ry + grow) * Math.sin(t));
      })
    );

  const doorCuts = spec.doors.map((x) => {
    const topY = spec.beltY + (x < spec.glassDlo[0][0] + 0.2 ? -0.015 : 0.02);
    return line([
      [x, spec.rockerY + 0.01],
      [x - 0.015, (spec.rockerY + topY) / 2],
      [x - 0.02, topY],
    ]);
  });

  const perpTilt = -kxy / kx;
  const axis = (top: Pt, span: number): [Pt, Pt] => axisFrom(top, Math.abs(ky * span), perpTilt);
  const roofY = spec.upper[9][1];
  const flankAxis = axis(p(spec.arch.front + 1.4, spec.beltY), spec.beltY - spec.rockerY);
  const topAxis = axis(p(spec.arch.front + 1.4, roofY), roofY - spec.beltY);
  const glassAxis = axis(p(spec.ws.top[0], spec.ws.top[1], glassZ), (spec.ws.top[1] - spec.beltY) * 1.15);

  const strip = (y0: number, y1: number, x0: number, x1: number) =>
    poly([p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)]);

  const front = p(spec.arch.front, 0, 0.03);
  const rear = p(spec.arch.rear, 0, 0.03);
  const angle = (Math.atan2(rear[1] - front[1], rear[0] - front[0]) * 180) / Math.PI;

  const wheelZ = 0.035;
  const wheels: Geometry['wheels'] = [];
  if (q3) {
    const [fx, fy] = p(spec.arch.front, R, W - 0.06);
    wheels.push({ cx: fx, cy: fy, far: true, shade: 0.52 });
  }
  const [nx, ny] = p(spec.arch.front, R, wheelZ);
  const [rx2, ry2] = p(spec.arch.rear, R, wheelZ);
  wheels.push({ cx: nx, cy: ny });
  wheels.push({ cx: rx2, cy: ry2, shade: q3 ? 0.1 : 0.06 });

  /* Door mirror: a small dark cap standing off the flank. */
  const m = spec.mirror;
  const mirrorAt = (z: number) =>
    shape(
      [
        [m.x, m.y],
        [m.x + m.w * 0.55, m.y + 0.014],
        [m.x + m.w, m.y - 0.012],
        [m.x + m.w * 0.9, m.y - m.h],
        [m.x + m.w * 0.4, m.y - m.h - 0.008],
        [m.x + 0.01, m.y - m.h * 0.7],
      ],
      z
    );

  /* Headlamp: one continuous blade that crosses the fascia and wraps the fender. */
  /* The blade has to die inside the fascia, so its far end is clamped to the
     fascia's own tapered edge at that height. */
  const zLamp = zFarAt(spec.lampBar[1]) - 0.05;
  const barZ = [zLamp, zLamp * 0.78, zLamp * 0.55, zLamp * 0.3, zLamp * 0.1, 0.02];
  const nX = spec.frontLower[2][0] + 0.02;
  const lampTop = barZ.map((z) => p(nX - bulgeAt(z), spec.lampBar[1] + (z > 0.1 ? 0.01 : 0), z));
  const lampBot = [...barZ].reverse().map((z) => p(nX - bulgeAt(z) + 0.01, spec.lampBar[0] + (z > 0.1 ? 0.01 : 0), z));
  const sideTop = spec.lampSide.slice(1, 3).map(([x, y]) => p(x, y));
  const sideBot = spec.lampSide.slice(3, 5).map(([x, y]) => p(x, y));
  const capY = (spec.lampBar[0] + spec.lampBar[1]) / 2 + 0.01;
  const lampCap = p(nX - bulgeAt(zLamp) - 0.012, capY, zLamp);
  const lampWrap = curve([lampCap, ...lampTop, ...sideTop, ...sideBot, ...lampBot], true);

  /* Lower intake and the corner air curtains, both on the fascia surface. */
  const gz = Array.from({ length: 7 }, (_, i) => spec.grille.z[0] + ((spec.grille.z[1] - spec.grille.z[0]) * i) / 6);
  const grille = curve(
    [
      ...gz.map((z) => p(nX + 0.02 - bulgeAt(z) * 0.85, spec.grille.y[1], z)),
      ...[...gz].reverse().map((z) => p(nX + 0.05 - bulgeAt(z) * 0.85, spec.grille.y[0], z)),
    ],
    true
  );
  const ventAt = (z0: number, z1: number) => {
    const vz = Array.from({ length: 4 }, (_, i) => z0 + ((z1 - z0) * i) / 3);
    return curve(
      [
        ...vz.map((z) => p(nX + 0.02 - bulgeAt(z) * 0.85, spec.vent.y[1], z)),
        ...[...vz].reverse().map((z) => p(nX + 0.05 - bulgeAt(z) * 0.85, spec.vent.y[0], z)),
      ],
      true
    );
  };
  const zVent = zFarAt(spec.vent.y[1]) - 0.1;
  const vents = [ventAt(spec.vent.z[0], spec.vent.z[1]), ventAt(zVent - (spec.vent.z[1] - spec.vent.z[0]), zVent)];
  const splitY = (spec.lampBar[0] + spec.grille.y[1]) / 2;
  const faceSplit = curve(sweep(splitY).map(([z, b]) => p(nX - b * 0.9, splitY, z)));
  const faceAxis = axisFrom(p(0.05, yHi + 0.02), Math.abs(ky) * (yHi - yLo + 0.12), -kxy / kx);

  return {
    outline,
    shell,
    face,
    faceLip,
    under,
    underAxis,
    hood,
    hoodCrown,
    roof,
    deck,
    windscreen,
    canopyEdge,
    sideGlass,
    pillar,
    archPockets: [`${archRing(spec.arch.front, 0)} Z`, `${archRing(spec.arch.rear, 0)} Z`],
    archShadows: [archRing(spec.arch.front, 0.025), archRing(spec.arch.rear, 0.025)],
    doorCuts,
    hoodCut: line([
      [spec.hoodPanel.rear[0], spec.hoodPanel.rear[1]],
      [spec.hoodPanel.rear[0] + 0.02, spec.beltY - 0.08],
      [spec.hoodPanel.rear[0] + 0.05, spec.rockerY + 0.2],
    ]),
    deckCut: line([
      [spec.tailSide[0][0] - 0.06, spec.beltY - 0.02],
      [spec.tailSide[0][0] - 0.03, (spec.beltY + spec.rockerY) / 2],
      [spec.tailSide[0][0] + 0.02, spec.rockerY + 0.1],
    ]),
    handles: spec.handles.map(([x, y]) =>
      poly([p(x - 0.09, y), p(x + 0.09, y + 0.004), p(x + 0.09, y - 0.03), p(x - 0.09, y - 0.034)])
    ),
    shoulder: line(spec.shoulder),
    darkBand: strip(spec.darkBand[0], spec.darkBand[1], spec.arch.front - 0.35, spec.arch.rear + 0.9),
    bounceBand: strip(spec.bounceBand[0], spec.bounceBand[1], spec.arch.front - 0.35, spec.arch.rear + 0.9),
    skirt: strip(spec.rockerY - 0.02, spec.rockerY + 0.055, spec.arch.front + 0.3, spec.arch.rear - 0.3),
    beltLine: line([
      [spec.arch.front - 0.1, spec.beltY - 0.02],
      [(spec.arch.front + spec.arch.rear) / 2, spec.beltY + 0.005],
      [spec.arch.rear + 0.8, spec.beltY + 0.02],
    ]),
    rockerLine: line([
      [spec.arch.front + 0.5, spec.rockerY + 0.025],
      [(spec.arch.front + spec.arch.rear) / 2, spec.rockerY + 0.02],
      [spec.arch.rear - 0.5, spec.rockerY + 0.025],
    ]),
    lampWrap,
    lampSide: shape(spec.lampSide),
    lampGlow: line(spec.lampSide.slice(0, 3)),
    grille,
    vents,
    faceSplit,
    faceAxis,
    tail: shape(spec.tailSide),
    mirrorNear: mirrorAt(-m.out),
    mirrorFar: mirrorAt(W + m.out),
    flankAxis,
    topAxis,
    glassAxis,
    contact: { front, rear, angle },
    wheels,
    wheelAx: kx * R,
    wheelAy: kxy * R,
    wheelBy: -ky * R,
    bounds: { x0: p(0, 0, q3 ? W : 0)[0], x1: p(4.75, 0)[0] },
  };
}

function describe(body: BodyStyle, paint: PaintOption, wheel: WheelOption, view: View): string {
  const shape = body === 'suv' ? 'SUV' : 'sedan';
  const angle = view === 'side' ? 'side profile' : 'front three-quarter view';
  return `Vela ${shape} in ${paint.name} with ${wheel.name}, ${angle}`;
}

/* ── Component ────────────────────────────────────────────────────────────*/

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
  const g = build(spec, view, wheel.size);
  const q3 = view === 'front-3q';
  const [fa, fb] = g.flankAxis;
  const [ta, tb] = g.topAxis;
  const [ga, gb] = g.glassAxis;
  const c = g.contact;
  const [ua, ub] = g.underAxis;
  const [ca, cb] = g.faceAxis;
  const flip = `translate(${c.front[0].toFixed(1)} ${c.front[1].toFixed(1)}) rotate(${c.angle.toFixed(2)})`;

  return (
    <svg
      className={className ? `car-render ${className}` : 'car-render'}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label ?? describe(body, paint, wheel, view)}
    >
      <defs>
        {/* The flank: sky at the shoulder, body colour through the middle, the
            dark studio floor low down, then a lick of bounce off the tile. */}
        <linearGradient id={`${uid}-flank`} gradientUnits="userSpaceOnUse" x1={fa[0]} y1={fa[1]} x2={fb[0]} y2={fb[1]}>
          <stop offset="0" stopColor={paint.sheen} data-paint />
          <stop offset="0.12" stopColor={paint.hex} data-paint />
          <stop offset="0.46" stopColor={paint.hex} data-paint />
          <stop offset="0.82" stopColor={paint.shade} data-paint />
          <stop offset="0.95" stopColor={paint.shade} data-paint />
          <stop offset="1" stopColor={paint.hex} data-paint />
        </linearGradient>
        {/* Upward-facing panels see the softbox, so they run light-to-mid. */}
        <linearGradient id={`${uid}-top`} gradientUnits="userSpaceOnUse" x1={ta[0]} y1={ta[1]} x2={tb[0]} y2={tb[1]}>
          <stop offset="0" stopColor={paint.sheen} data-paint />
          <stop offset="0.62" stopColor={paint.hex} data-paint />
          <stop offset="1" stopColor={paint.hex} data-paint />
        </linearGradient>
        <linearGradient
          id={`${uid}-face`}
          gradientUnits="userSpaceOnUse"
          x1={g.bounds.x0}
          y1="0"
          x2={g.bounds.x0 + 230}
          y2="0"
        >
          <stop offset="0" stopColor={paint.shade} data-paint />
          <stop offset="0.55" stopColor={paint.hex} data-paint />
          <stop offset="1" stopColor={paint.hex} data-paint />
        </linearGradient>
        <linearGradient id={`${uid}-sky`} gradientUnits="userSpaceOnUse" x1={ta[0]} y1={ta[1]} x2={tb[0]} y2={tb[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="0.66" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.2" />
        </linearGradient>

        {/* Reflections run along the car, so they fade on x. */}
        <linearGradient id={`${uid}-along`} gradientUnits="userSpaceOnUse" x1={g.bounds.x0} y1="0" x2={g.bounds.x1} y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.26" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.62" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-dark`} gradientUnits="userSpaceOnUse" x1={g.bounds.x0} y1="0" x2={g.bounds.x1} y2="0">
          <stop offset="0" stopColor={paint.shade} stopOpacity="0.12" data-paint />
          <stop offset="0.3" stopColor={paint.shade} stopOpacity="0.6" data-paint />
          <stop offset="0.8" stopColor={paint.shade} stopOpacity="0.48" data-paint />
          <stop offset="1" stopColor={paint.shade} stopOpacity="0.14" data-paint />
        </linearGradient>
        <linearGradient id={`${uid}-bounce`} gradientUnits="userSpaceOnUse" x1={g.bounds.x0} y1="0" x2={g.bounds.x1} y2="0">
          <stop offset="0" stopColor={paint.sheen} stopOpacity="0" data-paint />
          <stop offset="0.35" stopColor={paint.sheen} stopOpacity="0.42" data-paint />
          <stop offset="0.85" stopColor={paint.sheen} stopOpacity="0.24" data-paint />
          <stop offset="1" stopColor={paint.sheen} stopOpacity="0" data-paint />
        </linearGradient>
        <linearGradient id={`${uid}-crease`} gradientUnits="userSpaceOnUse" x1={g.bounds.x0} y1="0" x2={g.bounds.x1} y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.2" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="0.7" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* One continuous glass canopy — windscreen, roof, side glass. */}
        <linearGradient id={`${uid}-glass`} gradientUnits="userSpaceOnUse" x1={ga[0]} y1={ga[1]} x2={gb[0]} y2={gb[1]}>
          <stop offset="0" stopColor="#54606d" />
          <stop offset="0.34" stopColor="#2a323b" />
          <stop offset="0.74" stopColor="#181e25" />
          <stop offset="1" stopColor="#0c1014" />
        </linearGradient>
        <linearGradient id={`${uid}-ws`} gradientUnits="userSpaceOnUse" x1={ga[0]} y1={ga[1]} x2={gb[0]} y2={gb[1]}>
          <stop offset="0" stopColor="#616e7c" />
          <stop offset="0.3" stopColor="#333d48" />
          <stop offset="0.72" stopColor="#1c232b" />
          <stop offset="1" stopColor="#10151a" />
        </linearGradient>
        <linearGradient id={`${uid}-roofglass`} gradientUnits="userSpaceOnUse" x1={ta[0]} y1={ta[1]} x2={tb[0]} y2={tb[1]}>
          <stop offset="0" stopColor="#69747f" />
          <stop offset="0.45" stopColor="#272f38" />
          <stop offset="1" stopColor="#12171d" />
        </linearGradient>

        <linearGradient id={`${uid}-led`} gradientUnits="userSpaceOnUse" x1={g.bounds.x0} y1="0" x2={g.bounds.x0 + 300} y2="0">
          <stop offset="0" stopColor="#9db4d6" />
          <stop offset="0.35" stopColor="#ffffff" />
          <stop offset="0.75" stopColor="#e7effb" />
          <stop offset="1" stopColor="#a9bfdd" />
        </linearGradient>
        <linearGradient id={`${uid}-tail`} gradientUnits="userSpaceOnUse" x1={g.bounds.x1 - 150} y1="0" x2={g.bounds.x1} y2="0">
          <stop offset="0" stopColor="#8f1016" />
          <stop offset="0.45" stopColor="#d8261f" />
          <stop offset="1" stopColor="#f2604a" />
        </linearGradient>

        {/* The fascia turns away from the light top and bottom, and picks up a
            thin bounce off the studio floor along its very lowest edge. */}
        <linearGradient id={`${uid}-faceShade`} gradientUnits="userSpaceOnUse" x1={ca[0]} y1={ca[1]} x2={cb[0]} y2={cb[1]}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="0.3" stopColor="#ffffff" stopOpacity="0.03" />
          <stop offset="0.68" stopColor="#000000" stopOpacity="0.12" />
          <stop offset="0.92" stopColor="#000000" stopOpacity="0.34" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={`${uid}-under`} gradientUnits="userSpaceOnUse" x1={ua[0]} y1={ua[1]} x2={ub[0]} y2={ub[1]}>
          <stop offset="0" stopColor="#05070a" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#080b0f" stopOpacity="0.7" />
          <stop offset="0.82" stopColor="#0e1319" stopOpacity="0.26" />
          <stop offset="1" stopColor="#141a21" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0b0e12" stopOpacity="0.34" />
          <stop offset="0.5" stopColor="#0b0e12" stopOpacity="0.13" />
          <stop offset="1" stopColor="#0b0e12" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <RimDefs uid={uid} />

        <filter id={`${uid}-soft`} x="-30%" y="-320%" width="160%" height="740%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <filter id={`${uid}-tight`} x="-60%" y="-300%" width="220%" height="700%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id={`${uid}-hair`} x="-60%" y="-300%" width="220%" height="700%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>

        <clipPath id={`${uid}-clip-flank`}>
          <path d={g.outline} />
        </clipPath>
        <clipPath id={`${uid}-clip-face`}>
          <path d={g.face} />
        </clipPath>
        <clipPath id={`${uid}-clip-glass`}>
          <path d={g.sideGlass} />
        </clipPath>
        <mask id={`${uid}-mask-floor`}>
          <g transform={flip}>
            <rect x="-500" y="0" width="1600" height="110" fill={`url(#${uid}-fade)`} />
          </g>
        </mask>
      </defs>

      {ground && (
        <g className="car-render__floor" mask={`url(#${uid}-mask-floor)`} opacity="0.1">
          <use
            href={`#${uid}-car`}
            transform={`${flip} scale(1 -1) rotate(${(-c.angle).toFixed(2)}) translate(${(-c.front[0]).toFixed(1)} ${(
              -c.front[1]
            ).toFixed(1)})`}
          />
        </g>
      )}

      {ground && (
        <g
          className="car-render__shadow"
          transform={`translate(${((c.front[0] + c.rear[0]) / 2).toFixed(1)} ${(
            (c.front[1] + c.rear[1]) / 2
          ).toFixed(1)}) rotate(${c.angle.toFixed(2)})`}
        >
          <ellipse cx="0" cy="4" rx={(c.rear[0] - c.front[0]) / 2 + 86} ry="13" fill={`url(#${uid}-shadow)`} filter={`url(#${uid}-soft)`} />
        </g>
      )}

      {ground && (
        <g className="car-render__contact">
          {g.wheels
            .filter((w) => !w.far)
            .map((w) => (
              <ellipse
                key={w.cx}
                cx={w.cx}
                cy={w.cy + g.wheelBy}
                rx={Math.abs(g.wheelAx) * 0.8}
                ry="6"
                fill="#0b0e12"
                opacity="0.55"
                filter={`url(#${uid}-tight)`}
                transform={`rotate(${c.angle.toFixed(2)} ${w.cx.toFixed(1)} ${(w.cy + g.wheelBy).toFixed(1)})`}
              />
            ))}
        </g>
      )}

      <g id={`${uid}-car`}>
        <path d={g.under} fill={`url(#${uid}-under)`} filter={`url(#${uid}-tight)`} />
        {g.archPockets.map((d) => (
          <path key={d} d={d} fill="#07080b" />
        ))}

        {g.wheels.map((w) => (
          <Wheel
            key={`${w.cx.toFixed(1)}-${w.far ? 'f' : 'n'}`}
            uid={uid}
            style={wheel.style}
            size={wheel.size}
            cx={w.cx}
            cy={w.cy}
            ax={g.wheelAx}
            ay={g.wheelAy}
            by={g.wheelBy}
            shade={w.shade}
          />
        ))}

        {/* Body: top surfaces first, then the near flank over them. */}
        {q3 && (
          <>
            <path d={g.shell} fill={`url(#${uid}-top)`} data-paint />
            <path d={g.shell} fill={`url(#${uid}-sky)`} />
          </>
        )}
        <path d={g.outline} fill={`url(#${uid}-flank)`} data-paint />

        <g clipPath={`url(#${uid}-clip-flank)`}>
          <path d={g.darkBand} fill={`url(#${uid}-dark)`} data-paint />
          <path d={g.bounceBand} fill={`url(#${uid}-bounce)`} data-paint />
          <path d={g.beltLine} fill="none" stroke={`url(#${uid}-along)`} strokeWidth="15" filter={`url(#${uid}-tight)`} />
          {g.archShadows.map((d) => (
            <path key={d} d={d} fill="none" stroke="#05070a" strokeOpacity="0.42" strokeWidth="12" filter={`url(#${uid}-tight)`} />
          ))}
          <path d={g.shoulder} fill="none" stroke={`url(#${uid}-crease)`} strokeWidth="7" filter={`url(#${uid}-hair)`} />
          <path d={g.shoulder} fill="none" stroke={`url(#${uid}-crease)`} strokeWidth="1.6" />
          <path d={g.skirt} fill="#0d1014" fillOpacity="0.5" filter={`url(#${uid}-tight)`} />
          <path d={g.rockerLine} fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3" filter={`url(#${uid}-hair)`} />
          <g fill="none" stroke="#05070a" strokeOpacity="0.28" strokeWidth="1.5" strokeLinecap="round">
            {g.doorCuts.map((d) => (
              <path key={d} d={d} />
            ))}
            <path d={g.hoodCut} strokeOpacity="0.18" />
            <path d={g.deckCut} strokeOpacity="0.18" />
          </g>
          {g.handles.map((d) => (
            <g key={d}>
              <path d={d} fill="#ffffff" fillOpacity="0.32" />
              <path d={d} fill="none" stroke="#05070a" strokeOpacity="0.28" strokeWidth="0.8" />
            </g>
          ))}
          <path d={g.tail} fill="#0d1013" />
          <path d={g.tail} fill={`url(#${uid}-tail)`} transform="translate(0 1.2)" opacity="0.94" />
          <path d={g.tail} fill="none" stroke="#0a0c0f" strokeOpacity="0.5" strokeWidth="1" />
          {!q3 && (
            <>
              <path d={g.lampSide} fill="#0d1013" />
              <path d={g.lampSide} fill={`url(#${uid}-led)`} transform="translate(0 1.2)" />
              <path d={g.lampGlow} fill="none" stroke="#dceaff" strokeOpacity="0.75" strokeWidth="3" filter={`url(#${uid}-hair)`} />
            </>
          )}
        </g>

        {/* Glass canopy */}
        <path d={g.sideGlass} fill={`url(#${uid}-glass)`} />
        <g clipPath={`url(#${uid}-clip-glass)`}>
          <path
            d={g.beltLine}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.12"
            strokeWidth="24"
            transform={`translate(0 ${(-(spec.beltY - spec.rockerY) * 22).toFixed(1)})`}
            filter={`url(#${uid}-tight)`}
          />
        </g>
        <path d={g.sideGlass} fill="none" stroke="#080a0d" strokeOpacity="0.55" strokeWidth="2.4" />
        {q3 && (
          <>
            <path d={g.roof} fill={`url(#${uid}-roofglass)`} />
            <path d={g.windscreen} fill={`url(#${uid}-ws)`} />
            <path d={g.windscreen} fill="none" stroke="#080a0d" strokeOpacity="0.5" strokeWidth="2.2" />
            <path d={g.canopyEdge} fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="1.6" />
            <path d={g.pillar} fill="#101317" />
            <path d={g.deck} fill={`url(#${uid}-top)`} data-paint />
            <path d={g.deck} fill={`url(#${uid}-sky)`} />
          </>
        )}

        {/* Mirrors */}
        {q3 && (
          <>
            <path d={g.mirrorFar} fill={`url(#${uid}-face)`} data-paint />
            <path d={g.mirrorFar} fill="#05070a" fillOpacity="0.4" />
          </>
        )}
        <path d={g.mirrorNear} fill={`url(#${uid}-flank)`} data-paint />
        <path d={g.mirrorNear} fill="#05070a" fillOpacity="0.2" />

        {/* Front end — nearest to camera, so it lands last. */}
        {q3 && (
          <>
            <path d={g.hood} fill={`url(#${uid}-top)`} data-paint />
            <path d={g.hood} fill={`url(#${uid}-sky)`} />
            <path d={g.hoodCrown} fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="5" filter={`url(#${uid}-hair)`} />
            <path d={g.hoodCrown} fill="none" stroke="#05070a" strokeOpacity="0.12" strokeWidth="1" />
            <path d={g.face} fill={`url(#${uid}-face)`} data-paint />
            <g clipPath={`url(#${uid}-clip-face)`}>
              <path d={g.face} fill={`url(#${uid}-faceShade)`} />
              <path d={g.faceSplit} fill="none" stroke="#05070a" strokeOpacity="0.24" strokeWidth="1.4" />
              <path d={g.faceSplit} fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.6" transform="translate(0 2.2)" />
              <path d={g.grille} fill="#0d1013" fillOpacity="0.9" />
              <path d={g.grille} fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="2" transform="translate(0 -2)" />
              {g.vents.map((d) => (
                <path key={d} d={d} fill="#0d1013" fillOpacity="0.78" />
              ))}
              <path d={g.faceLip} fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="3" filter={`url(#${uid}-hair)`} />
              <path d={g.lampWrap} fill="#0a0d11" transform="translate(0 -1.6)" />
              <path d={g.lampWrap} fill="#0a0d11" transform="translate(0 1.8)" />
              <path d={g.lampWrap} fill={`url(#${uid}-led)`} />
              <path d={g.lampWrap} fill="#ffffff" opacity="0.5" filter={`url(#${uid}-hair)`} />
              <path d={g.lampWrap} fill="none" stroke="#0a0d11" strokeOpacity="0.65" strokeWidth="1.1" />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}
