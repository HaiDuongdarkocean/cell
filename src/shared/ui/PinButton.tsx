import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './PinButton.module.css';

interface PinButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Controlled pinned state. When true, shows pinOff icon + active visual. */
  pinned: boolean;
}

/**
 * PinButton — controlled toggle atom for pin/unpin actions.
 *
 * Icon-only button: shows `pin` when unpinned, `pinOff` when pinned.
 * `aria-pressed` reflects the toggle state; `aria-label` is required for
 * icon-only accessibility.
 */
export function PinButton({
  pinned,
  className,
  ...rest
}: PinButtonProps): React.JSX.Element {
  const cls = [styles.pinBtn, pinned ? styles.pinned : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={cls}
      aria-pressed={pinned}
      aria-label={pinned ? 'Unpin' : 'Pin'}
      {...rest}
    >
      <Icon name={pinned ? 'pinOff' : 'pin'} size={20} />
    </button>
  );
}
