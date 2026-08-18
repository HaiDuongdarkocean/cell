import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'primarySubtle' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonOrientation = 'horizontal' | 'vertical';
type ButtonElevation = 'none' | 'low' | 'med' | 'high';
type ButtonActiveStyle = 'default' | 'flat';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Default: primary. */
  variant?: ButtonVariant;
  /** Size. Default: md. */
  size?: ButtonSize;
  /** Layout direction: horizontal (icon+label inline) or vertical (icon top, label bottom). Default: horizontal. */
  orientation?: ButtonOrientation;
  /** Persistent active/toggle state. Default: pale-blue subtle bg + primary color. */
  active?: boolean;
  /** Active state visual: 'default' (pale-blue bg + primary color) or 'flat' (primary color only, no bg, no animation). Default: default. */
  activeStyle?: ButtonActiveStyle;
  /** Show loading spinner and disable interactions. */
  loading?: boolean;
  /** Stretch to fill the available width. */
  fullWidth?: boolean;
  /** Elevation shadow. Default: none. */
  elevation?: ButtonElevation;
  /** Ripple effect on click from pointer position. Disables hover bg. Default: false. */
  ripple?: boolean;
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
  orientation = 'horizontal',
  active = false,
  activeStyle = 'default',
  loading = false,
  fullWidth = false,
  elevation = 'none',
  ripple = false,
  leadingIcon,
  trailingIcon,
  children,
  disabled,
  className,
  onPointerDown,
  ...rest
}: ButtonProps, ref): React.JSX.Element {
  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    onPointerDown?.(e);
    if (!ripple || e.defaultPrevented) return;
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const diameter = Math.min(rect.width, rect.height) * 1.2;
    const radius = diameter / 2;
    const x = e.clientX - rect.left - radius;
    const y = e.clientY - rect.top - radius;
    const span = btn.ownerDocument.createElement('span');
    span.className = styles.ripple;
    span.style.width = span.style.height = `${diameter}px`;
    span.style.left = `${x}px`;
    span.style.top = `${y}px`;
    btn.appendChild(span);
    span.addEventListener('animationend', () => span.remove(), { once: true });
  };

  const cls = [
    styles.button,
    styles[variant],
    styles[size],
    orientation === 'vertical' ? styles.vertical : '',
    active ? (activeStyle === 'flat' ? styles.activeFlat : styles.active) : '',
    loading ? styles.loading : '',
    fullWidth ? styles.fullWidth : '',
    elevation !== 'none' ? styles[`elevation_${elevation}`] : '',
    ripple ? styles.rippleHost : '',
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
      onPointerDown={handlePointerDown}
      {...rest}
    >
      {loading && <Spinner size="md" color="current" aria-hidden="true" />}
      {!loading && leadingIcon && <span className={styles.leadingIcon}>{leadingIcon}</span>}
      {children && <span className={styles.label}>{children}</span>}
      {trailingIcon && <span className={styles.trailingIcon}>{trailingIcon}</span>}
    </button>
  );
});
