import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactElement } from 'react';
import { money } from '@/lib/format';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import './AnimatedPrice.css';

export interface AnimatedPriceProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: number;
  className?: string;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Approximate advance width, in `ch`, of a string set in tabular figures. */
function reserveCh(text: string): number {
  let width = 0;
  for (const char of text) {
    if (char >= '0' && char <= '9') width += 1;
    else if (char === ',' || char === '.' || char === ' ') width += 0.32;
    else width += 0.62;
  }
  return Math.ceil(width * 100) / 100;
}

export function AnimatedPrice({
  value,
  className,
  duration = 420,
  prefix = '',
  suffix = '',
  style,
  ...rest
}: AnimatedPriceProps): ReactElement {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (reduced || duration <= 0 || from === value) {
      fromRef.current = value;
      displayRef.current = value;
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (value - from) * easeOut(t);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        displayRef.current = value;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      // Resume from wherever the tween was interrupted, never from a stale value.
      fromRef.current = displayRef.current;
    };
  }, [value, duration, reduced]);

  const settled = `${prefix}${money(value)}${suffix}`;
  const text = `${prefix}${money(display)}${suffix}`;
  // Reserve the wider of the two so a count-down cannot widen the box mid-tween.
  const reserve = Math.max(reserveCh(settled), reserveCh(text));
  const merged: CSSProperties = { minWidth: `${reserve}ch`, ...style };

  return (
    <span {...rest} className={className ? `aprice ${className}` : 'aprice'} style={merged}>
      <span aria-hidden="true">{text}</span>
      <span className="aprice__live" aria-live="polite">
        {settled}
      </span>
    </span>
  );
}

export default AnimatedPrice;
