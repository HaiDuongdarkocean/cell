import type { ButtonHTMLAttributes } from 'react';
import { IconButton } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import styles from './FullscreenButton.module.css';

interface FullscreenButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  /** Controlled fullscreen state. Default false. */
  fullscreen?: boolean;
}

/**
 * FullscreenButton — Domain Video atom (SA-9 §6.A.7).
 *
 * Controlled toggle for fullscreen mode. Icon toggles `maximize`/`minimize`
 * from ICON_CATALOG. `aria-pressed` mirrors `fullscreen`; `aria-label` is dynamic.
 * Capability detection via `document.fullscreenEnabled` — disabled when unsupported.
 */
export function FullscreenButton({
  fullscreen = false,
  className,
  disabled,
  ...rest
}: FullscreenButtonProps): React.JSX.Element {
  const supported =
    typeof document !== 'undefined' && typeof document.fullscreenEnabled === 'boolean'
      ? document.fullscreenEnabled
      : true;

  return (
    <IconButton
      active={fullscreen}
      disabled={disabled || !supported}
      aria-pressed={fullscreen}
      aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      className={[styles.fullscreenBtn, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon name={fullscreen ? 'minimize' : 'maximize'} size={24} />
    </IconButton>
  );
}
