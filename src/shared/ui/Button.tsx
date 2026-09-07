import { Children, forwardRef, isValidElement, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { Spinner } from './Spinner';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'primarySubtle' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link' | 'success' | 'transparent';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type ButtonShape = 'pill' | 'circle';
type ButtonOrientation = 'horizontal' | 'vertical';
type ButtonElevation = 'none' | 'low' | 'med' | 'high';
type ButtonActiveStyle = 'default' | 'flat';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. Default: primary. */
  variant?: ButtonVariant;
  /** Hide label when nested in a container narrower than 380px. */
  collapseLabel?: boolean;
  /** Size. Default: md. */
  size?: ButtonSize;
  /** Shape. Default: pill. Icon-only buttons auto-switch to circle. */
  shape?: ButtonShape;
  /** Layout direction: horizontal (icon+label inline) or vertical (icon top, label bottom). Default: horizontal. */
  orientation?: ButtonOrientation;
  /** Persistent active/toggle state. Default: pale-blue subtle bg + primary color. */
  active?: boolean;
  /** Dimmed primary look (disabled-like opacity). Lifts on hover, fully lit
   *  when the caller sets aria-selected/aria-pressed="true". Only affects
   *  variant="primary". */
  dimmed?: boolean;
  /** Active state visual: 'default' (pale-blue bg + primary color) or 'flat' (primary color only, no bg, no animation). Default: default. */
  activeStyle?: ButtonActiveStyle;
  /** Show loading spinner and disable interactions. */
  loading?: boolean;
  /** Error state — button reports a failed action (error-subtle fill + error blob). */
  error?: boolean;
  /** Stretch to fill the available width. */
  fullWidth?: boolean;
  /** Elevation shadow. Default: none. */
  elevation?: ButtonElevation;
  /** Ripple effect on click from pointer position. Default: true. */
  ripple?: boolean;
  /** One-shot ripple: icon+label flash to primary color while ripple spreads, then revert. Default: false. */
  ripplePulse?: boolean;
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
  shape,
  orientation = 'horizontal',
  active = false,
  activeStyle = 'default',
  dimmed = false,
  loading = false,
  error = false,
  fullWidth = false,
  collapseLabel = false,
  elevation = 'none',
  ripple = true,
  ripplePulse = false,
  leadingIcon,
  trailingIcon,
  children,
  disabled,
  className,
  style,
  onPointerDown,
  ...rest
}: ButtonProps, ref): React.JSX.Element {
  const [pulsing, setPulsing] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    onPointerDown?.(e);
    if (!ripple || e.defaultPrevented) return;
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const diameter = Math.max(rect.width, rect.height) * 1.6;
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

    if (ripplePulse) {
      setPulsing(true);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulsing(false), 2000);
    }
  };

  const childCount = Children.count(children);
  const onlyChildIsElement = childCount === 1 && isValidElement(children);
  const hasTextChild = childCount > 0 && !onlyChildIsElement;
  const iconOnly = !hasTextChild && !leadingIcon && !trailingIcon && !loading && (onlyChildIsElement || childCount === 0);
  const resolvedShape = shape ?? (iconOnly ? 'circle' : 'pill');

  const cls = [
    styles.button,
    styles[variant],
    styles[size],
    resolvedShape === 'circle' ? styles.circle : '',
    orientation === 'vertical' ? styles.vertical : '',
    active ? (activeStyle === 'flat' ? styles.activeFlat : styles.active) : '',
    dimmed ? styles.dimmed : '',
    loading ? styles.loading : '',
    iconOnly ? styles.iconOnly : '',
    error ? styles.error : '',
    fullWidth ? styles.fullWidth : '',
    collapseLabel ? styles.collapseLabel : '',
    elevation !== 'none' ? styles[`elevation_${elevation}`] : '',
    ripple ? styles.rippleHost : '',
    ripplePulse && pulsing ? styles.ripplePulsing : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type="button"
      className={cls}
      style={style}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-invalid={error || undefined}
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
