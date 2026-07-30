import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './MinimizeButton.module.css';

interface MinimizeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Override the default aria-label. Default: "Minimize". */
  ariaLabel?: string;
}

/**
 * MinimizeButton — icon-only button with the `minimize` icon from ICON_CATALOG.
 *
 * `aria-label="Minimize"` is required for icon-only accessibility.
 * Use this for window/panel minimize actions.
 */
export function MinimizeButton({
  ariaLabel = 'Minimize',
  className,
  ...rest
}: MinimizeButtonProps): React.JSX.Element {
  const cls = [styles.minimizeBtn, className ?? ''].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      aria-label={ariaLabel}
      {...rest}
    >
      <Icon name="minimize" size={20} />
    </button>
  );
}
