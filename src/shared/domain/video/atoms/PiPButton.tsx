import type { ButtonHTMLAttributes } from 'react';
import { IconButton } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import styles from './PiPButton.module.css';

interface PiPButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  /** Controlled picture-in-picture state. Default false. */
  pip?: boolean;
}

/**
 * PiPButton — Domain Video atom (SA-9 §6.A.8).
 *
 * Controlled toggle for picture-in-picture mode. Icon `pip` from ICON_CATALOG.
 * `aria-pressed` mirrors `pip`; `aria-label` is dynamic.
 * Capability detection via `document.pictureInPictureEnabled` — disabled when unsupported.
 */
export function PiPButton({
  pip = false,
  className,
  disabled,
  ...rest
}: PiPButtonProps): React.JSX.Element {
  const supported =
    typeof document !== 'undefined' &&
    typeof (document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled ===
      'boolean'
      ? (document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled
      : true;

  return (
    <IconButton
      active={pip}
      disabled={disabled || !supported}
      aria-pressed={pip}
      aria-label={pip ? 'Exit picture-in-picture' : 'Enter picture-in-picture'}
      className={[styles.pipBtn, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <Icon name="pip" size={24} />
    </IconButton>
  );
}
