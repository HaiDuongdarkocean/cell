import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './MaximizeButton.module.css';

type MaximizeButtonSize = 'sm' | 'md' | 'lg';

const ICON_SIZE: Record<MaximizeButtonSize, number> = { sm: 16, md: 18, lg: 20 };

interface MaximizeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Controlled maximized state. When true, shows minimize icon (restore). */
  maximized: boolean;
  /** Button box size: sm=28px, md=32px, lg=36px. Default 'md'. */
  size?: MaximizeButtonSize;
}

/**
 * MaximizeButton — controlled toggle atom for maximize/restore actions.
 *
 * Shows `maximize` icon when not maximized, `minimize` icon when maximized
 * (restore). `aria-pressed` reflects the toggle state; `aria-label` is
 * dynamic ("Maximize" / "Restore") for icon-only accessibility.
 */
export function MaximizeButton({
  maximized,
  size = 'md',
  className,
  ...rest
}: MaximizeButtonProps): React.JSX.Element {
  const cls = [styles.maximizeBtn, styles[size], maximized ? styles.maximized : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      aria-pressed={maximized}
      aria-label={maximized ? 'Restore' : 'Maximize'}
      {...rest}
    >
      <Icon name={maximized ? 'minimize' : 'maximize'} size={ICON_SIZE[size]} />
    </button>
  );
}
