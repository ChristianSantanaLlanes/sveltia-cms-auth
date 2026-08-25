import { useId, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import './Field.css';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  suffix?: ReactNode;
}

export function Field({
  label,
  error,
  hint,
  suffix,
  id,
  className,
  placeholder,
  'aria-describedby': describedBy,
  ...rest
}: FieldProps): ReactElement {
  const autoId = useId();
  const inputId = id ?? `field-${autoId}`;
  const msgId = `${inputId}-msg`;

  /* One message slot, always in the layout. An error replacing a hint — or
     appearing on submit — must never shift the fields below it. */
  const message = error ?? hint ?? '';
  const described = [describedBy, message ? msgId : null].filter(Boolean).join(' ');

  return (
    <div className={['field', error ? 'field--error' : null, className].filter(Boolean).join(' ')}>
      <div className={`field__box${suffix ? ' field__box--suffix' : ''}`}>
        <input
          {...rest}
          id={inputId}
          className="field__input"
          /* A space keeps :placeholder-shown meaningful so the label can float
             without tracking value state. */
          placeholder={placeholder ?? ' '}
          aria-invalid={error ? true : undefined}
          aria-describedby={described || undefined}
        />
        <label className="field__label" htmlFor={inputId}>
          {label}
        </label>
        {suffix ? <span className="field__suffix">{suffix}</span> : null}
      </div>

      <p className={`field__msg${error ? ' field__msg--error' : ''}`} id={msgId}>
        {message}
      </p>
    </div>
  );
}

export default Field;
