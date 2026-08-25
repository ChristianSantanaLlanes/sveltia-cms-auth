import type { ReactElement } from 'react';
import type { WheelOption } from '@/types';

/**
 * Rim, tyre and brake geometry for the Vela car render.
 *
 * Every rim face is authored on a unit circle (tyre radius = 1) and placed by
 * <Wheel /> with a 2×3 matrix, so one design serves every wheel size and every
 * camera angle: the matrix carries the foreshortening of the three-quarter
 * view, which means a wheel is never a hand-tuned ellipse.
 *
 * Angles run clockwise on screen (SVG y grows downward) from 12 o'clock.
 */

export interface RimProps {
  /** Unique-per-CarRender gradient id prefix. */
  uid: string;
}

export interface WheelProps extends RimProps {
  style: WheelOption['style'];
  /** Rim diameter in inches — drives the rim / sidewall proportion. */
  size: number;
  cx: number;
  cy: number;
  /** Screen vector of one tyre radius along the car's length axis. */
  ax?: number;
  ay?: number;
  /** Screen y of one tyre radius straight down. */
  by?: number;
  /** Plain screen radius — the simple case, used by swatch thumbnails. */
  r?: number;
  /** 0 → lit, 1 → fully in shade. Used for the far wheel. */
  shade?: number;
}

const TOP = -Math.PI / 2;
const INCH = 0.0254;

/** Point on a circle of radius `r` at angle `a`, as SVG path coordinates. */
function p(a: number, r: number): string {
  return `${(Math.cos(a) * r).toFixed(4)},${(Math.sin(a) * r).toFixed(4)}`;
}

/** Clockwise arc to angle `a` on radius `r`. */
function arcTo(a: number, r: number): string {
  return `A ${r} ${r} 0 0 1 ${p(a, r)}`;
}

/** Evenly spaced angles, `count` of them, starting at 12 o'clock. */
function spokes(count: number): number[] {
  return Array.from({ length: count }, (_, i) => TOP + (i * Math.PI * 2) / count);
}

/**
 * Overall tyre radius in metres. A bigger rim keeps very nearly the same rolling
 * diameter — the sidewall gets thinner, exactly as it does on a real car.
 */
export function tyreRadius(size: number): number {
  const clamped = Math.min(22, Math.max(17, size));
  return 0.3425 + (clamped - 18) * 0.0022;
}

/** Rim face radius as a fraction of the tyre radius — real section heights. */
export function rimRatio(size: number): number {
  const clamped = Math.min(22, Math.max(17, size));
  return (clamped * INCH) / 2 / tyreRadius(clamped);
}

/* ── Shared paint ────────────────────────────────────────────────────────── */

/** Gradients shared by every wheel on one render. Emit once, inside <defs>. */
export function RimDefs({ uid }: RimProps): ReactElement {
  return (
    <>
      <linearGradient id={`${uid}-tyre`} x1="0.16" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#54585f" />
        <stop offset="0.3" stopColor="#31353b" />
        <stop offset="0.68" stopColor="#191b1f" />
        <stop offset="1" stopColor="#0b0c0e" />
      </linearGradient>
      <radialGradient id={`${uid}-tyre-in`} cx="0.44" cy="0.32" r="0.8">
        <stop offset="0.5" stopColor="#000000" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.62" />
      </radialGradient>
      <linearGradient id={`${uid}-lip`} x1="0.1" y1="0" x2="0.86" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.26" stopColor="#e2e6ea" />
        <stop offset="0.56" stopColor="#9aa1aa" />
        <stop offset="0.8" stopColor="#666d76" />
        <stop offset="1" stopColor="#3d434a" />
      </linearGradient>
      <linearGradient id={`${uid}-rim-face`} x1="0.18" y1="0" x2="0.82" y2="1">
        <stop offset="0" stopColor="#fafbfc" />
        <stop offset="0.34" stopColor="#ced4da" />
        <stop offset="0.66" stopColor="#8f959e" />
        <stop offset="0.88" stopColor="#5e646c" />
        <stop offset="1" stopColor="#464b52" />
      </linearGradient>
      <radialGradient id={`${uid}-barrel`} cx="0.5" cy="0.42" r="0.62">
        <stop offset="0" stopColor="#23262b" />
        <stop offset="0.66" stopColor="#121417" />
        <stop offset="1" stopColor="#060709" />
      </radialGradient>
      <linearGradient id={`${uid}-disc`} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#9aa0a7" />
        <stop offset="0.5" stopColor="#5d636a" />
        <stop offset="1" stopColor="#33373c" />
      </linearGradient>
      <linearGradient id={`${uid}-vane`} x1="0.08" y1="0" x2="0.92" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.06" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.26" />
      </linearGradient>
      <radialGradient id={`${uid}-cap`} cx="0.34" cy="0.28" r="0.82">
        <stop offset="0" stopColor="#666d76" />
        <stop offset="0.6" stopColor="#2b2f35" />
        <stop offset="1" stopColor="#131619" />
      </radialGradient>
    </>
  );
}

/* ── Rim faces (unit = rim radius) ───────────────────────────────────────── */

/** Aero — a turbine-cut cover that hides the barrel entirely. */
export function AeroRim({ uid }: RimProps): ReactElement {
  const vane = (a: number) => {
    const ro = 0.9;
    const ri = 0.3;
    const sw = 0.4;
    const t = 0.15;
    return [
      `M ${p(a, ro)}`,
      `Q ${p(a + sw * 0.56, ro * 0.64)} ${p(a + sw, ri)}`,
      `L ${p(a + sw + t * 0.5, ri * 1.2)}`,
      `Q ${p(a + sw * 0.64 + t, ro * 0.7)} ${p(a + t, ro)}`,
      'Z',
    ].join(' ');
  };
  return (
    <g>
      <circle r="0.93" fill={`url(#${uid}-rim-face)`} />
      <g fill={`url(#${uid}-vane)`}>
        {spokes(11).map((a) => (
          <path key={a} d={vane(a)} />
        ))}
      </g>
      <circle r="0.93" fill="none" stroke="#000000" strokeOpacity="0.22" strokeWidth="0.028" />
      <circle r="0.31" fill={`url(#${uid}-rim-face)`} />
      <circle r="0.31" fill="none" stroke="#000000" strokeOpacity="0.2" strokeWidth="0.024" />
    </g>
  );
}

/** Sport — five twin-spokes converging on the hub. */
export function SportRim({ uid }: RimProps): ReactElement {
  const ro = 0.9;
  const ri = 0.23;
  const leg = (a: number, s: number) => {
    const o1 = a + s * 0.055;
    const o2 = a + s * 0.2;
    const i1 = a + s * 0.02;
    const i2 = a + s * 0.09;
    return `M ${p(o1, ro)} ${arcTo(o2, ro)} L ${p(i2, ri)} L ${p(i1, ri)} Z`;
  };
  return (
    <g>
      <g fill={`url(#${uid}-rim-face)`}>
        {spokes(5).map((a) => (
          <g key={a}>
            <path d={leg(a, 1)} />
            <path d={leg(a, -1)} />
          </g>
        ))}
      </g>
      <g fill="#ffffff" fillOpacity="0.34">
        {spokes(5).map((a) => (
          <path key={a} d={`M ${p(a + 0.058, ro)} ${arcTo(a + 0.086, ro)} L ${p(a + 0.034, ri)} L ${p(a + 0.024, ri)} Z`} />
        ))}
      </g>
      <circle r="0.28" fill={`url(#${uid}-rim-face)`} />
    </g>
  );
}

/** Turbine — a curved multi-blade face over a shallow barrel. */
export function TurbineRim({ uid }: RimProps): ReactElement {
  const ro = 0.91;
  const ri = 0.25;
  const sw = 0.46;
  const t = 0.14;
  const blade = (a: number) =>
    [
      `M ${p(a, ro)}`,
      `C ${p(a + sw * 0.4, ro * 0.72)} ${p(a + sw * 0.8, ri * 1.75)} ${p(a + sw, ri)}`,
      `L ${p(a + sw + t * 0.5, ri * 1.16)}`,
      `C ${p(a + sw * 0.84 + t, ri * 1.92)} ${p(a + sw * 0.44 + t, ro * 0.76)} ${p(a + t, ro)}`,
      'Z',
    ].join(' ');
  return (
    <g>
      <g fill={`url(#${uid}-rim-face)`}>
        {spokes(10).map((a) => (
          <path key={a} d={blade(a)} />
        ))}
      </g>
      <g fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.016">
        {spokes(10).map((a) => (
          <path
            key={a}
            d={`M ${p(a + 0.024, ro * 0.97)} C ${p(a + sw * 0.4, ro * 0.7)} ${p(a + sw * 0.8, ri * 1.72)} ${p(a + sw * 0.96, ri * 1.06)}`}
          />
        ))}
      </g>
      <circle r="0.3" fill={`url(#${uid}-rim-face)`} />
    </g>
  );
}

/** Arc — ten slender spokes over a deep concave barrel. */
export function ArachnidRim({ uid }: RimProps): ReactElement {
  const ro = 0.93;
  const ri = 0.19;
  const spoke = (a: number) => {
    const wo = 0.052;
    const wi = 0.024;
    return `M ${p(a - wi, ri)} L ${p(a - wo, ro)} ${arcTo(a + wo, ro)} L ${p(a + wi, ri)} Z`;
  };
  return (
    <g>
      <g fill={`url(#${uid}-rim-face)`}>
        {spokes(10).map((a) => (
          <path key={a} d={spoke(a)} />
        ))}
      </g>
      <g fill="#ffffff" fillOpacity="0.38">
        {spokes(10).map((a) => (
          <path key={a} d={`M ${p(a - 0.024, ri)} L ${p(a - 0.052, ro)} L ${p(a - 0.034, ro)} L ${p(a - 0.012, ri)} Z`} />
        ))}
      </g>
      <circle r="0.24" fill={`url(#${uid}-rim-face)`} />
    </g>
  );
}

export const RIM_BY_STYLE: Record<WheelOption['style'], (props: RimProps) => ReactElement> = {
  aero: AeroRim,
  sport: SportRim,
  turbine: TurbineRim,
  arachnid: ArachnidRim,
};

/* ── Full wheel ──────────────────────────────────────────────────────────── */

/**
 * Tyre, brake and rim, placed by the caller's projection matrix. `ax/ay` is one
 * tyre radius along the car; `by` is one tyre radius straight down. In the side
 * view that is a plain scale; in the three-quarter view it foreshortens the
 * wheel by exactly cos(yaw), which is what stops it reading as a sticker.
 */
export function Wheel({ uid, style, size, cx, cy, ax, ay, by, r = 1, shade = 0 }: WheelProps): ReactElement {
  const Rim = RIM_BY_STYLE[style] ?? AeroRim;
  const mA = ax ?? r;
  const mB = ay ?? 0;
  const mD = by ?? r;
  const rim = rimRatio(size);
  const tread = 0.975;
  const dash = ((Math.PI * 2 * tread) / 52).toFixed(4);
  const solid = style !== 'aero';

  return (
    <g transform={`matrix(${mA.toFixed(3)} ${mB.toFixed(3)} 0 ${mD.toFixed(3)} ${cx.toFixed(2)} ${cy.toFixed(2)})`}>
      <circle r="1" fill={`url(#${uid}-tyre)`} />
      <circle
        r={tread}
        fill="none"
        stroke="#000000"
        strokeOpacity="0.45"
        strokeWidth="0.055"
        strokeDasharray={`${dash} ${dash}`}
      />
      <circle r="0.94" fill={`url(#${uid}-tyre)`} />
      <circle r="0.94" fill={`url(#${uid}-tyre-in)`} />
      <circle r={(rim + 0.94) / 2} fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="0.018" />

      <g transform={`scale(${rim.toFixed(4)})`}>
        {/* Outer lip, then the barrel the spokes float over. */}
        <circle r="1" fill={`url(#${uid}-lip)`} />
        <circle r="0.94" fill={`url(#${uid}-barrel)`} />
        {solid && (
          <>
            <circle r="0.7" fill={`url(#${uid}-disc)`} />
            <circle r="0.7" fill="none" stroke="#000000" strokeOpacity="0.4" strokeWidth="0.04" />
            <circle r="0.44" fill="#20242a" />
            <path d="M -0.74 -0.24 A 0.78 0.78 0 0 1 -0.36 -0.68 L -0.22 -0.44 A 0.5 0.5 0 0 0 -0.48 -0.14 Z" fill="#2c3138" />
          </>
        )}
        <Rim uid={uid} />
        <circle r="0.155" fill={`url(#${uid}-cap)`} />
        <circle r="0.155" fill="none" stroke="#ffffff" strokeOpacity="0.24" strokeWidth="0.018" />
        <path d="M -0.068 0.046 L 0 -0.07 L 0.068 0.046 L 0 0.012 Z" fill="#ffffff" fillOpacity="0.75" />
        <circle r="0.99" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="0.02" />
      </g>

      {shade > 0 && <circle r="1" fill="#05070a" fillOpacity={shade} />}
    </g>
  );
}
