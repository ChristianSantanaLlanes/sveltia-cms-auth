import type { ReactElement } from 'react';
import type { WheelOption } from '@/types';

/**
 * Rim + tyre geometry for the Vela car render.
 *
 * Every rim face is authored on a unit circle (rim radius = 1) and scaled into
 * place by <Wheel />, so a single design serves every wheel size. Angles run
 * clockwise on screen (SVG y grows downward) starting from 12 o'clock.
 */

export interface RimProps {
  /** Unique-per-CarRender gradient id prefix. */
  uid: string;
}

export interface WheelProps extends RimProps {
  style: WheelOption['style'];
  /** Wheel diameter in inches — drives the rim / sidewall proportion. */
  size: number;
  cx: number;
  cy: number;
  /** Outer tyre radius in user units. */
  r: number;
  /** Horizontal foreshortening for three-quarter views (1 = full side-on). */
  squash?: number;
  /** 0 → lit, 1 → fully in shade. Used for the far / trailing wheel. */
  shade?: number;
}

const TOP = -Math.PI / 2;

/** Point on a circle of radius `r` at angle `a`, as SVG path coordinates. */
function p(a: number, r: number): string {
  return `${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r).toFixed(3)}`;
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
 * Rim face as a fraction of the overall tyre radius. An 18" wheel keeps a fat
 * sidewall; a 22" fills the arch with rim and leaves a rubber band.
 */
export function rimRatio(size: number): number {
  const clamped = Math.min(22, Math.max(17, size));
  return 0.688 + (clamped - 18) * 0.0445;
}

/* ── Shared paint ────────────────────────────────────────────────────────── */

/** Gradients shared by every wheel on one render. Emit once, inside <defs>. */
export function RimDefs({ uid }: RimProps): ReactElement {
  return (
    <>
      <linearGradient id={`${uid}-tyre`} x1="0.18" y1="0" x2="0.78" y2="1">
        <stop offset="0" stopColor="#4a4e55" />
        <stop offset="0.34" stopColor="#2c2f34" />
        <stop offset="0.72" stopColor="#191b1f" />
        <stop offset="1" stopColor="#0d0e11" />
      </linearGradient>
      <radialGradient id={`${uid}-tyre-in`} cx="0.42" cy="0.34" r="0.78">
        <stop offset="0.55" stopColor="#000000" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.55" />
      </radialGradient>
      <linearGradient id={`${uid}-rim`} x1="0.14" y1="0.02" x2="0.82" y2="0.98">
        <stop offset="0" stopColor="#fbfcfd" />
        <stop offset="0.28" stopColor="#dfe3e8" />
        <stop offset="0.58" stopColor="#a7aeb7" />
        <stop offset="0.82" stopColor="#767d87" />
        <stop offset="1" stopColor="#4e545c" />
      </linearGradient>
      <linearGradient id={`${uid}-rim-face`} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#f4f6f8" />
        <stop offset="0.42" stopColor="#c3c9d0" />
        <stop offset="0.74" stopColor="#8b929b" />
        <stop offset="1" stopColor="#5a6069" />
      </linearGradient>
      <radialGradient id={`${uid}-barrel`} cx="0.5" cy="0.44" r="0.62">
        <stop offset="0" stopColor="#26292e" />
        <stop offset="0.7" stopColor="#141619" />
        <stop offset="1" stopColor="#08090b" />
      </radialGradient>
      <linearGradient id={`${uid}-vane`} x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.08" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.22" />
      </linearGradient>
      <radialGradient id={`${uid}-cap`} cx="0.36" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#5b626b" />
        <stop offset="0.6" stopColor="#2b2f35" />
        <stop offset="1" stopColor="#15181b" />
      </radialGradient>
    </>
  );
}

/* ── Rim faces (unit radius) ─────────────────────────────────────────────── */

/** 18" Aero — turbine-covered disc with shallow radial vanes. */
export function AeroRim({ uid }: RimProps): ReactElement {
  const vane = (a: number) => {
    const ro = 0.9;
    const ri = 0.36;
    const sw = 0.36;
    const t = 0.17;
    return [
      `M ${p(a, ro)}`,
      `Q ${p(a + sw * 0.58, ro * 0.68)} ${p(a + sw, ri)}`,
      `L ${p(a + sw + t * 0.45, ri * 1.16)}`,
      `Q ${p(a + sw * 0.66 + t, ro * 0.74)} ${p(a + t, ro)}`,
      'Z',
    ].join(' ');
  };
  return (
    <g>
      <circle r="0.985" fill={`url(#${uid}-rim)`} />
      <circle r="0.9" fill={`url(#${uid}-rim-face)`} />
      <g fill={`url(#${uid}-vane)`}>
        {spokes(12).map((a) => (
          <path key={a} d={vane(a)} />
        ))}
      </g>
      <circle r="0.9" fill="none" stroke="#000000" strokeOpacity="0.2" strokeWidth="0.03" />
      <circle r="0.96" fill="none" stroke="#ffffff" strokeOpacity="0.42" strokeWidth="0.022" />
      <circle r="0.38" fill="none" stroke="#000000" strokeOpacity="0.24" strokeWidth="0.028" />
    </g>
  );
}

/** 19" Sport — five twin-spokes converging on the hub. */
export function SportRim({ uid }: RimProps): ReactElement {
  const ro = 0.9;
  const ri = 0.25;
  const leg = (a: number, s: number) => {
    const o1 = a + s * 0.05;
    const o2 = a + s * 0.185;
    const i1 = a + s * 0.018;
    const i2 = a + s * 0.082;
    return `M ${p(o1, ro)} ${arcTo(o2, ro)} L ${p(i2, ri)} L ${p(i1, ri)} Z`;
  };
  return (
    <g>
      <circle r="0.985" fill={`url(#${uid}-rim)`} />
      <circle r="0.94" fill={`url(#${uid}-barrel)`} />
      <g fill={`url(#${uid}-rim-face)`}>
        {spokes(5).map((a) => (
          <g key={a}>
            <path d={leg(a, 1)} />
            <path d={leg(a, -1)} />
          </g>
        ))}
      </g>
      <g fill="#ffffff" fillOpacity="0.3">
        {spokes(5).map((a) => (
          <path key={a} d={`M ${p(a + 0.052, ro)} ${arcTo(a + 0.078, ro)} L ${p(a + 0.03, ri)} L ${p(a + 0.02, ri)} Z`} />
        ))}
      </g>
      <circle r="0.3" fill={`url(#${uid}-rim-face)`} />
      <circle r="0.96" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.024" />
      <circle r="0.9" fill="none" stroke="#000000" strokeOpacity="0.3" strokeWidth="0.03" />
    </g>
  );
}

/** 20" Turbine — curved multi-blade face. */
export function TurbineRim({ uid }: RimProps): ReactElement {
  const ro = 0.92;
  const ri = 0.27;
  const sw = 0.44;
  const t = 0.145;
  const blade = (a: number) =>
    [
      `M ${p(a, ro)}`,
      `C ${p(a + sw * 0.42, ro * 0.74)} ${p(a + sw * 0.82, ri * 1.72)} ${p(a + sw, ri)}`,
      `L ${p(a + sw + t * 0.5, ri * 1.14)}`,
      `C ${p(a + sw * 0.86 + t, ri * 1.9)} ${p(a + sw * 0.46 + t, ro * 0.78)} ${p(a + t, ro)}`,
      'Z',
    ].join(' ');
  return (
    <g>
      <circle r="0.985" fill={`url(#${uid}-rim)`} />
      <circle r="0.94" fill={`url(#${uid}-barrel)`} />
      <g fill={`url(#${uid}-rim-face)`}>
        {spokes(10).map((a) => (
          <path key={a} d={blade(a)} />
        ))}
      </g>
      <g fill="none" stroke="#ffffff" strokeOpacity="0.26" strokeWidth="0.018">
        {spokes(10).map((a) => (
          <path key={a} d={`M ${p(a + 0.02, ro * 0.98)} C ${p(a + sw * 0.42, ro * 0.72)} ${p(a + sw * 0.82, ri * 1.7)} ${p(a + sw * 0.98, ri * 1.04)}`} />
        ))}
      </g>
      <circle r="0.32" fill={`url(#${uid}-rim-face)`} />
      <circle r="0.96" fill="none" stroke="#ffffff" strokeOpacity="0.38" strokeWidth="0.024" />
    </g>
  );
}

/** 20–22" Arachnid — ten slender spokes over a deep concave barrel. */
export function ArachnidRim({ uid }: RimProps): ReactElement {
  const ro = 0.94;
  const ri = 0.21;
  const spoke = (a: number) => {
    const wo = 0.055;
    const wi = 0.026;
    return `M ${p(a - wi, ri)} L ${p(a - wo, ro)} ${arcTo(a + wo, ro)} L ${p(a + wi, ri)} Z`;
  };
  return (
    <g>
      <circle r="0.985" fill={`url(#${uid}-rim)`} />
      <circle r="0.955" fill={`url(#${uid}-barrel)`} />
      <g fill={`url(#${uid}-rim-face)`}>
        {spokes(10).map((a) => (
          <path key={a} d={spoke(a)} />
        ))}
      </g>
      <g fill="#ffffff" fillOpacity="0.34">
        {spokes(10).map((a) => (
          <path key={a} d={`M ${p(a - 0.026, ri)} L ${p(a - 0.055, ro)} L ${p(a - 0.036, ro)} L ${p(a - 0.014, ri)} Z`} />
        ))}
      </g>
      <circle r="0.26" fill={`url(#${uid}-rim-face)`} />
      <circle r="0.96" fill="none" stroke="#ffffff" strokeOpacity="0.46" strokeWidth="0.026" />
      <circle r="0.9" fill="none" stroke="#000000" strokeOpacity="0.34" strokeWidth="0.026" />
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

/** Tyre + rim + hub cap, positioned and foreshortened for the current view. */
export function Wheel({ uid, style, size, cx, cy, r, squash = 1, shade = 0 }: WheelProps): ReactElement {
  const Rim = RIM_BY_STYLE[style] ?? AeroRim;
  const rim = r * rimRatio(size);
  const tread = r * 0.965;
  const circumference = Math.PI * 2 * tread;
  const dash = circumference / 46;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${squash} 1)`}>
      <circle r={r} fill={`url(#${uid}-tyre)`} />
      <circle
        r={tread}
        fill="none"
        stroke="#000000"
        strokeOpacity="0.5"
        strokeWidth={r * 0.07}
        strokeDasharray={`${(dash * 0.5).toFixed(2)} ${(dash * 0.5).toFixed(2)}`}
      />
      <circle r={r * 0.93} fill={`url(#${uid}-tyre)`} />
      <circle r={r * 0.93} fill={`url(#${uid}-tyre-in)`} />
      <circle
        r={(rim + r * 0.93) / 2}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.055"
        strokeWidth={r * 0.02}
      />
      <g transform={`scale(${rim})`}>
        <Rim uid={uid} />
        <circle r="0.17" fill={`url(#${uid}-cap)`} />
        <circle r="0.17" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="0.02" />
        <path d="M -0.075 0.05 L 0 -0.075 L 0.075 0.05 L 0 0.012 Z" fill="#ffffff" fillOpacity="0.72" />
      </g>
      {shade > 0 && <circle r={r} fill="#05070a" fillOpacity={shade} />}
    </g>
  );
}
