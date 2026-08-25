import { useId, type ReactElement, type SelectHTMLAttributes } from 'react';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  /** Convenience shorthand; `children` (<option> nodes) works too. */
  options?: SelectOption[];
  hint?: string;
  error?: string;
  /** Keeps the label for assistive tech but hides it visually. */
  hideLabel?: boolean;
}

export function Select({
  label,
  options,
  hint,
  error,
  hideLabel = false,
  id,
  className,
  children,
  'aria-describedby': describedBy,
  ...rest
}: SelectProps): ReactElement {
  const autoId = useId();
  const selectId = id ?? `select-${autoId}`;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  const described = [describedBy, error ? errorId : null, !error && hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={['select', error ? 'select--error' : null, className].filter(Boolean).join(' ')}>
      <label className={hideLabel ? 'select__label sr-only' : 'select__label'} htmlFor={selectId}>
        {label}
      </label>
      <div className="select__box">
        <select
          {...rest}
          id={selectId}
          className="select__control"
          aria-invalid={error ? true : undefined}
          aria-describedby={described || undefined}
        >
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <span className="select__chevron" aria-hidden="true" />
      </div>

      {error ? (
        <p className="select__msg select__msg--error" id={errorId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="select__msg" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default Select;
