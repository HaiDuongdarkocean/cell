import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/icons/Icon';
import styles from './BackButton.module.css';

type BackButtonSize = 'sm' | 'md' | 'lg';

const ICON_SIZE: Record<BackButtonSize, number> = { sm: 16, md: 18, lg: 20 };

interface BackButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Show a "Back" text label next to the chevron. Default: false (icon-only). */
  showLabel?: boolean;
  /** Override the default label text. Default: "Back". */
  label?: string;
  /** Button box size: sm=28px, md=32px, lg=36px height. Default 'md'. */
  size?: BackButtonSize;
  /** Optional leading/trailing children — unused, kept for extensibility. */
  children?: ReactNode;
}

/**
 * BackButton — navigation atom with a left chevron icon.
 *
 * Icon-only by default (`aria-label="Go back"`). Pass `showLabel` to render
 * a visible "Back" text label alongside the icon.
 */
export function BackButton({
  showLabel = false,
  label = 'Back',
  size = 'md',
  className,
  children,
  ...rest
}: BackButtonProps): React.JSX.Element {
  const cls = [styles.backBtn, styles[size], className ?? ''].filter(Boolean).join(' ');
  return (
    <Button material="solid" variant="secondary"
      className={cls}
      aria-label="Go back"
      {...rest}
    >
      <Icon name="chevronLeft" size={ICON_SIZE[size]} />
      {showLabel && <span className={styles.label}>{label}</span>}
      {children}
    </Button>
  );
}
