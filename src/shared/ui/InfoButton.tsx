import type { ButtonHTMLAttributes } from 'react';
import { Button } from './Button';
import { Icon } from '@/shared/icons/Icon';
import styles from './InfoButton.module.css';

type InfoButtonSize = 'sm' | 'md' | 'lg';
type InfoButtonVariant = 'ghost' | 'outline';

const ICON_SIZE: Record<InfoButtonSize, number> = { sm: 16, md: 18, lg: 20 };

interface InfoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Override the default aria-label. Default: "More information". */
  ariaLabel?: string;
  /** Visual variant: ghost=transparent bg, outline=hairline border only. Default 'ghost'. */
  variant?: InfoButtonVariant;
  /** Button box size: sm=28px, md=32px, lg=36px. Default 'md'. */
  size?: InfoButtonSize;
}

/**
 * InfoButton — icon-only info button with the `info` icon from ICON_CATALOG.
 *
 * `aria-label="More information"` is required for icon-only accessibility.
 * Use this for triggering help/info popovers or navigation to details.
 */
export function InfoButton({
  ariaLabel = 'More information',
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: InfoButtonProps): React.JSX.Element {
  const cls = [styles.infoBtn, styles[size], styles[variant], className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <Button shape="circle" variant={variant}
      className={cls}
      aria-label={ariaLabel}
      {...rest}
    >
      <Icon name="info" size={ICON_SIZE[size]} />
    </Button>
  );
}
