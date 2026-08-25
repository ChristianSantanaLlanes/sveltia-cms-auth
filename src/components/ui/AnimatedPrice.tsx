import { useEffect, useState, type CSSProperties, type HTMLAttributes, type ReactElement } from 'react';
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

const REEL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** `/mo` is a glyph, not a word: give speech the word instead. */
function spoken(suffix: string): string {
  return suffix === '/mo' ? ' per month' : suffix;
}

/**
 * An odometer. Each digit position is a reel of 0–9 clipped to one line and
 * translated to the digit it should show, so a price change rolls the digits
 * that actually changed and leaves the rest still. Columns are keyed by place
 * value counted from the right, so the hundreds column stays the hundreds
 * column when the number gains or loses a digit.
 */
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
  // The first paint must land on the value, not roll up to it from zero.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const text = `${prefix}${money(value)}`;
  const chars = [...text];
  const still = reduced || !armed;

  const vars: CSSProperties = {
    '--aprice-dur': `${still ? 0 : duration}ms`,
    '--aprice-stagger': still ? '0ms' : '26ms',
    ...style,
  } as CSSProperties;

  return (
    <span {...rest} className={className ? `aprice ${className}` : 'aprice'} style={vars}>
      <span className="aprice__row" aria-hidden="true">
        {chars.map((char, i) => {
          const place = chars.length - 1 - i;
          const digit = char >= '0' && char <= '9' ? Number(char) : -1;
          if (digit < 0) {
            return (
              <span className="aprice__punct" key={`p${place}`}>
                {char}
              </span>
            );
          }
          return (
            <span
              className="aprice__cell"
              key={`d${place}`}
              style={{ '--d': digit, '--p': place } as CSSProperties}
            >
              <span className="aprice__ghost">0</span>
              <span className="aprice__clip">
                <span className="aprice__reel">
                  {REEL.map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </span>
              </span>
            </span>
          );
        })}
        {suffix ? <span className="aprice__unit">{suffix}</span> : null}
      </span>

      {/* The reels are decorative markup; only the settled value is announced. */}
      <span className="aprice__live" aria-live="polite">
        {text}
        {spoken(suffix)}
      </span>
    </span>
  );
}

export default AnimatedPrice;
