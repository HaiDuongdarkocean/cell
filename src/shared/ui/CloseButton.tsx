import type { ButtonHTMLAttributes } from 'react';
import { Button } from './Button';
import { Icon } from '@/shared/icons/Icon';
import styles from './CloseButton.module.css';

interface CloseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Size: sm=32, md=40. Default 'md'. */
  size?: 'sm' | 'md';
  /** Visual style: ghost=transparent with surface-hover on hover, solid=filled primary background. Default 'ghost'. */
  variant?: 'ghost' | 'solid';
}

/**
 * CloseButton — icon-only button that dismisses a panel, dialog, or card.
 *
 * Renders the `x` icon from ICON_CATALOG. `aria-label="Close"` is set by default
 * and can be overridden via props. Touch target meets 40px (desktop) / 44px (mobile).
 */
export function CloseButton({
  size = 'md',
  variant = 'ghost',
  className,
  'aria-label': ariaLabel = 'Close',
  ...rest
}: CloseButtonProps): React.JSX.Element {
  const cls = [styles.closeBtn, styles[variant], className ?? ''].filter(Boolean).join(' ');

  return (
    <Button shape="circle" variant={variant === 'solid' ? 'primary' : 'ghost'} size={size} className={cls} aria-label={ariaLabel} {...rest}>
      <Icon name="x"  />
    </Button>
  );
}
