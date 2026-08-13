import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Spinner } from './Spinner';
import styles from './IconButton.module.css';

type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';
type IconButtonVariant = 'solid' | 'outline' | 'ghost' | 'transparent' | 'danger';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Size: xs=28, sm=32, md=40, lg=48. Default 'md'. */
  size?: IconButtonSize;
  /** Visual style: solid=primary fill, outline=hairline border, ghost=surface-hover bg on hover,
   *  transparent=no bg/border/hover-bg, danger=error-subtle bg + error color on hover. Default 'ghost'. */
  variant?: IconButtonVariant;
  /** Persistent active state (no hover change). variant='ghost'+active → primary; variant='danger'+active → danger. */
  active?: boolean;
  /** Show a loading spinner and disable interactions. */
  loading?: boolean;
  /** Ref to the underlying button element. */
  ref?: Ref<HTMLButtonElement>;
  children?: ReactNode;
}

/**
 * IconButton atom — design-system-ui-ux Step 3.
 *
 * Icon-only transparent button with consistent hover/focus/radius across the extension.
 * 11 call sites pass Rule of Three (Header, SettingsDialog, VideoCard, SubtitleCard,
 * SelectionBar, DownloadCard). Consumes tokens only — no raw hex/radius.
 *
 * Icon size is controlled by the SVG child (width/height attrs), not by this atom.
 * The atom only controls the button box + hover/focus/active states.
 */
export function IconButton({
  size = 'md',
  variant = 'ghost',
  active = false,
  loading = false,
  className,
  children,
  disabled,
  ref,
  ...rest
}: IconButtonProps): React.JSX.Element {
  const sizeClass = styles[size] ?? '';
  const variantClass = styles[variant] ?? '';
  const activeClass = active
    ? variant === 'danger'
      ? styles.activeDanger
      : styles.activePrimary
    : '';
  const cls = `${styles.iconBtn} ${sizeClass} ${variantClass} ${activeClass} ${loading ? styles.loading : ''} ${className ?? ''}`.trim();
  return (
    <button
      type="button"
      ref={ref}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="xl" color="current" aria-hidden="true" /> : children}
    </button>
  );
}
