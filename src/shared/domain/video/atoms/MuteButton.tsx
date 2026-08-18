import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './MuteButton.module.css';

interface MuteButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Controlled muted state. */
  muted: boolean;
  /** Current volume level 0–1 (used to pick the unmute icon). */
  volume: number;
}

/** Pick volume icon based on effective volume (0 when muted). */
function volumeIconName(effective: number): 'volumeHigh' | 'volumeLow' | 'volumeMute' {
  if (effective <= 0) return 'volumeMute';
  if (effective < 0.5) return 'volumeLow';
  return 'volumeHigh';
}

/**
 * MuteButton — domain video atom (atom-design-plan §6.A.5).
 *
 * Controlled mute toggle: caller owns `muted` and `volume` state.
 * Shows a dynamic icon (volumeHigh / volumeLow / volumeMute) based on the
 * effective volume (0 when muted).
 *
 * Accessibility: `aria-pressed` reflects muted state, `aria-label` is dynamic
 * ("Mute" / "Unmute"), 40px touch target.
 */
export function MuteButton({
  muted,
  volume,
  className,
  ...rest
}: MuteButtonProps): React.JSX.Element {
  const effective = muted ? 0 : volume;
  const iconName = volumeIconName(effective);
  const label = muted ? 'Unmute' : 'Mute';

  const cls = [styles.button, className ?? ''].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      aria-pressed={muted}
      {...rest}
    >
      <Icon name={iconName} className={styles.icon} />
    </button>
  );
}
