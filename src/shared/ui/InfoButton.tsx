import type { ButtonHTMLAttributes } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './InfoButton.module.css';

interface InfoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Override the default aria-label. Default: "More information". */
  ariaLabel?: string;
}

/**
 * InfoButton — icon-only info button with the `info` icon from ICON_CATALOG.
 *
 * `aria-label="More information"` is required for icon-only accessibility.
 * Use this for triggering help/info popovers or navigation to details.
 */
export function InfoButton({
  ariaLabel = 'More information',
  className,
  ...rest
}: InfoButtonProps): React.JSX.Element {
  const cls = [styles.infoBtn, className ?? ''].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      aria-label={ariaLabel}
      {...rest}
    >
      <Icon name="info" size={20} />
    </button>
  );
}
