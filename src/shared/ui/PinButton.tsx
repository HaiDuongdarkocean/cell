import type { ButtonHTMLAttributes } from 'react';
import { Button } from './Button';
import { Icon } from '@/shared/icons/Icon';
import styles from './PinButton.module.css';

type PinButtonSize = 'sm' | 'md' | 'lg';

const ICON_SIZE: Record<PinButtonSize, number> = { sm: 16, md: 18, lg: 20 };

interface PinButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Controlled pinned state. When true, shows pinOff icon + active visual. */
  pinned: boolean;
  /** Button box size: sm=28px, md=32px, lg=36px. Default 'md'. */
  size?: PinButtonSize;
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
  size = 'md',
  className,
  ...rest
}: PinButtonProps): React.JSX.Element {
  const cls = [styles.pinBtn, styles[size], pinned ? styles.pinned : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <Button shape="circle" material="solid" variant="ghost"
      className={cls}
      aria-pressed={pinned}
      aria-label={pinned ? 'Unpin' : 'Pin'}
      {...rest}
    >
      <Icon name={pinned ? 'pinOff' : 'pin'} size={ICON_SIZE[size]} />
    </Button>
  );
}
