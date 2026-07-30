import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '@/shared/icons/Icon';
import styles from './BackButton.module.css';

interface BackButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Show a "Back" text label next to the chevron. Default: false (icon-only). */
  showLabel?: boolean;
  /** Override the default label text. Default: "Back". */
  label?: string;
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
  className,
  children,
  ...rest
}: BackButtonProps): React.JSX.Element {
  const cls = [styles.backBtn, className ?? ''].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      aria-label="Go back"
      {...rest}
    >
      <Icon name="chevronLeft" size={20} />
      {showLabel && <span className={styles.label}>{label}</span>}
      {children}
    </button>
  );
}
