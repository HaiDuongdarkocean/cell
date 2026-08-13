import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonElevation = 'none' | 'low' | 'med' | 'high';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Default: primary. */
  variant?: ButtonVariant;
  /** Size. Default: md. */
  size?: ButtonSize;
  /** Show loading spinner and disable interactions. */
  loading?: boolean;
  /** Stretch to fill the available width. */
  fullWidth?: boolean;
  /** Elevation shadow. Default: none. */
  elevation?: ButtonElevation;
  /** Icon before the label. */
  leadingIcon?: ReactNode;
  /** Icon after the label. */
  trailingIcon?: ReactNode;
  /** Optional child content. */
  children?: ReactNode;
}

/**
 * Button — primary click target with consistent hover, active, focus, disabled,
 * and loading states across the extension.
 *
 * Variants: primary, secondary, outline, ghost, destructive, link.
 * Sizes: sm, md, lg.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  elevation = 'none',
  leadingIcon,
  trailingIcon,
  children,
  disabled,
  className,
  ...rest
}: ButtonProps, ref): React.JSX.Element {
  const cls = [
    styles.button,
    styles[variant],
    styles[size],
    loading ? styles.loading : '',
    fullWidth ? styles.fullWidth : '',
    elevation !== 'none' ? styles[`elevation_${elevation}`] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size="md" color="current" aria-hidden="true" />}
      {!loading && leadingIcon && <span className={styles.leadingIcon}>{leadingIcon}</span>}
      {children && <span className={styles.label}>{children}</span>}
      {trailingIcon && <span className={styles.trailingIcon}>{trailingIcon}</span>}
    </button>
  );
});
