import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Input.module.css';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Size. Default: md. */
  size?: InputSize;
  /** Error state. */
  error?: boolean;
  /** Optional error message displayed below the input. */
  errorMessage?: ReactNode;
}

/**
 * Input — styled text input with standard focus, error, and disabled states.
 */
export function Input({ size = 'md', error, errorMessage, className, ...rest }: InputProps): React.JSX.Element {
  const cls = [styles.input, styles[size], error ? styles.error : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <>
      <input className={cls} aria-invalid={error || undefined} aria-describedby={errorMessage ? 'input-error' : undefined} {...rest} />
      {errorMessage && (
        <span id="input-error" className={styles.errorText} role="alert">
          {errorMessage}
        </span>
      )}
    </>
  );
}
