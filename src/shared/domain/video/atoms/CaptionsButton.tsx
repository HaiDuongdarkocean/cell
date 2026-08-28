import type { ButtonHTMLAttributes } from 'react';
import { IconButton } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import styles from './CaptionsButton.module.css';

interface CaptionsButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  /** Controlled captions state. Default false. */
  captionsOn?: boolean;
  /** Whether captions track is available. When false the button is disabled. Default true. */
  available?: boolean;
}

/**
 * CaptionsButton — Domain Video atom (SA-9 §6.A.6).
 *
 * Controlled toggle for closed-caption display. Icon `captions` from ICON_CATALOG.
 * `aria-pressed` mirrors `captionsOn`; disabled when `available=false`.
 * Active visual (accent bg) delegated to IconButton `active` prop.
 */
export function CaptionsButton({
  captionsOn = false,
  available = true,
  className,
  disabled,
  ...rest
}: CaptionsButtonProps): React.JSX.Element {
  return (
    <IconButton material="solid"
      active={captionsOn}
      disabled={disabled || !available}
      aria-pressed={captionsOn}
      aria-label={captionsOn ? 'Captions on' : 'Captions off'}
      className={[styles.captionsBtn, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon name="captions"  />
    </IconButton>
  );
}
