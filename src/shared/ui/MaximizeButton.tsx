import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './MaximizeButton.module.css';

interface MaximizeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Controlled maximized state. When true, shows minimize icon (restore). */
  maximized: boolean;
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
  className,
  ...rest
}: MaximizeButtonProps): React.JSX.Element {
  const cls = [styles.maximizeBtn, maximized ? styles.maximized : '', className ?? '']
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
      <Icon name={maximized ? 'minimize' : 'maximize'} size={20} />
    </button>
  );
}
