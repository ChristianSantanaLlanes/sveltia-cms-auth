import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactElement } from 'react';
import { Link } from 'react-router-dom';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'onImageLight' | 'onImageDark' | 'text';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  /** When set, renders a react-router `<Link>` with identical styling. */
  to?: string;
  loading?: boolean;
}

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  onImageLight: 'btn--on-image-light',
  onImageDark: 'btn--on-image-dark',
  text: 'btn--text',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  to,
  loading = false,
  disabled = false,
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps): ReactElement {
  const blocked = disabled || loading;

  const classes = [
    'btn',
    VARIANT_CLASS[variant],
    `btn--${size}`,
    fullWidth ? 'btn--full' : null,
    loading ? 'is-loading' : null,
    blocked ? 'is-blocked' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // The label stays in the DOM at opacity 0 while loading: the button keeps its
  // width and its accessible name, and the spinner sits on top of it.
  const content = (
    <>
      <span className="btn__label">{children}</span>
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : null}
    </>
  );

  if (to) {
    const anchorProps = rest as unknown as AnchorHTMLAttributes<HTMLAnchorElement>;
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (blocked) {
        event.preventDefault();
        return;
      }
      (onClick as unknown as ((e: MouseEvent<HTMLAnchorElement>) => void) | undefined)?.(event);
    };

    return (
      <Link
        {...anchorProps}
        to={to}
        className={classes}
        onClick={handleClick}
        aria-disabled={blocked || undefined}
        aria-busy={loading || undefined}
        tabIndex={blocked ? -1 : anchorProps.tabIndex}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      disabled={blocked}
      onClick={onClick}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
}

export { Button };
