import type { ButtonHTMLAttributes } from 'react';
import { Button } from './Button';
import { Icon } from '@/shared/icons/Icon';
import styles from './MinimizeButton.module.css';

type MinimizeButtonSize = 'sm' | 'md' | 'lg';
type MinimizeButtonVariant = 'ghost' | 'outline';

const ICON_SIZE: Record<MinimizeButtonSize, number> = { sm: 16, md: 18, lg: 20 };

interface MinimizeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Override the default aria-label. Default: "Minimize". */
  ariaLabel?: string;
  /** Visual variant: ghost=transparent bg, outline=hairline border only. Default 'ghost'. */
  variant?: MinimizeButtonVariant;
  /** Button box size: sm=28px, md=32px, lg=36px. Default 'md'. */
  size?: MinimizeButtonSize;
}

/**
 * MinimizeButton — icon-only button with the `minimize` icon from ICON_CATALOG.
 *
 * `aria-label="Minimize"` is required for icon-only accessibility.
 * Use this for window/panel minimize actions.
 */
export function MinimizeButton({
  ariaLabel = 'Minimize',
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: MinimizeButtonProps): React.JSX.Element {
  const cls = [styles.minimizeBtn, styles[size], styles[variant], className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <Button shape="circle" variant={variant}
      className={cls}
      aria-label={ariaLabel}
      {...rest}
    >
      <Icon name="minimize" size={ICON_SIZE[size]} />
    </Button>
  );
}
