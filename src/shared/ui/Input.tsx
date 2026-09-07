import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './Spinner';
import styles from './Input.module.css';

type InputSize = 'sm' | 'md' | 'lg';
type InputVariant = 'filled' | 'outline' | 'ghost';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  /** Size. Default: md. */
  size?: InputSize;
  /** Visual variant. Default: filled. */
  variant?: InputVariant;
  /** Error state. */
  error?: boolean;
  /** Success state. */
  success?: boolean;
  /** Loading state — shows a spinner and disables the input. */
  loading?: boolean;
  /** Optional error message displayed below the input. */
  errorMessage?: ReactNode;
  /** Optional helper text displayed below the input. */
  helperText?: ReactNode;
  /** Optional content rendered at the start of the input (e.g. icon). */
  prefix?: ReactNode;
  /** Optional content rendered at the end of the input (e.g. icon, action). */
  suffix?: ReactNode;
}

/**
 * Input — styled text input with solid surface, focus, error, success,
 * disabled, loading, and prefix/suffix support.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'md',
    variant = 'filled',
    error = false,
    success = false,
    loading = false,
    errorMessage,
    helperText,
    prefix,
    suffix,
    className,
    disabled,
    readOnly,
    'aria-describedby': ariaDescribedBy,
    ...rest
  }: InputProps,
  ref
): React.JSX.Element {
  const hasPrefix = Boolean(prefix);
  const hasSuffix = Boolean(suffix) || loading;
  const suffixContent = loading ? (
    <Spinner size="md" color="current" ariaLabel="Loading" />
  ) : (
    suffix
  );

  const cls = [
    styles.input,
    styles[variant],
    styles[size],
    hasPrefix ? styles.hasPrefix : '',
    hasSuffix ? styles.hasSuffix : '',
    error ? styles.error : '',
    success ? styles.success : '',
    loading ? styles.loading : '',
    readOnly ? styles.readOnly : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const id = useId();
  const errorId = errorMessage ? `${id}-error` : undefined;
  const helperId = helperText ? `${id}-helper` : undefined;
  const describedBy = [ariaDescribedBy, errorId, helperId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.root}>
      <div className={styles.wrapper}>
        {hasPrefix && (
          <span className={styles.prefix} aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          className={cls}
          disabled={disabled || loading}
          readOnly={readOnly}
          aria-invalid={error || undefined}
          aria-describedby={describedBy}
          aria-busy={loading || undefined}
          {...rest}
        />
        {hasSuffix && (
          <span className={styles.suffix}>
            {suffixContent}
          </span>
        )}
      </div>
      {errorMessage && (
        <span id={errorId} className={styles.errorText} role="alert">
          {errorMessage}
        </span>
      )}
      {helperText && (
        <span id={helperId} className={styles.helperText}>
          {helperText}
        </span>
      )}
    </div>
  );
});
