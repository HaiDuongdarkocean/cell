import type { ButtonHTMLAttributes, Ref } from 'react';
import styles from './IconButton.module.css';

type IconButtonSize = 'xs' | 'sm' | 'md';
type IconButtonVariant = 'ghost' | 'danger';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Size: xs=24, sm=28, md=32. Default 'md'. */
  size?: IconButtonSize;
  /** Hover behavior: ghost=surface-hover bg, danger=error-subtle bg + error color. Default 'ghost'. */
  variant?: IconButtonVariant;
  /** Persistent active state (no hover change). variant='ghost'+active → primary; variant='danger'+active → danger. */
  active?: boolean;
  /** Ref to the underlying button element. */
  ref?: Ref<HTMLButtonElement>;
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
  className,
  children,
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
  const cls = `${styles.iconBtn} ${sizeClass} ${variantClass} ${activeClass} ${className ?? ''}`.trim();
  return (
    <button type="button" ref={ref} className={cls} {...rest}>
      {children}
    </button>
  );
}
