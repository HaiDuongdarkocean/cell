import type { ButtonHTMLAttributes } from 'react';
import { IconButton } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import styles from './SkipButton.module.css';

type SkipDirection = 'forward' | 'backward';

interface SkipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Seek direction. Default 'forward'. */
  direction?: SkipDirection;
  /** Number of seconds to skip. Default 10. */
  seconds?: number;
}

/**
 * SkipButton — Domain Video atom (SA-9 §6.A.9).
 *
 * Seeks the video forward/backward by `seconds`. Icon toggles
 * `navForward`/`navRewind` from ICON_CATALOG (catalog uses nav-cluster names,
 * not `skipForward`/`skipBackward`). `aria-label` is dynamic
 * ("Skip forward 10 seconds" / "Skip backward 10 seconds").
 */
export function SkipButton({
  direction = 'forward',
  seconds = 10,
  className,
  ...rest
}: SkipButtonProps): React.JSX.Element {
  const iconName = direction === 'forward' ? 'navForward' : 'navRewind';
  const label = `Skip ${direction} ${seconds} seconds`;

  return (
    <IconButton material="solid"
      aria-label={label}
      className={[styles.skipBtn, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon name={iconName}  />
    </IconButton>
  );
}
