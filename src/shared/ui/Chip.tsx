import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import styles from './Chip.module.css';

export type ChipColor = 'success' | 'error' | 'primary' | 'warning' | 'muted';

interface ChipBaseProps {
  /** Visual style. Default: default. */
  variant?: 'default' | 'outline';
  /** Color accent. Default: none. */
  color?: ChipColor;
  /** Selected (active) state — only meaningful when `as="button"`. */
  selected?: boolean;
  /** Size. Default: md. */
  size?: 'sm' | 'md';
  /** Optional icon before the label. */
  leadingIcon?: ReactNode;
  /** Chip label. */
  children: ReactNode;
  className?: string;
}

type ChipAsButton = ChipBaseProps & {
  as: 'button';
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ChipBaseProps>;

type ChipAsSpan = ChipBaseProps & {
  as?: 'span';
} & Omit<HTMLAttributes<HTMLSpanElement>, keyof ChipBaseProps>;

type ChipProps = ChipAsButton | ChipAsSpan;

/**
 * Chip — compact selectable tag or display label with pill radius.
 *
 * When `as="button"` the chip is interactive/selectable (aria-pressed reflects
 * `selected`). When `as="span"` (default) it is a static display label.
 * Touch target meets 40px (desktop) / 44px (mobile).
 */
export function Chip({
  variant = 'default',
  color,
  selected = false,
  size = 'md',
  leadingIcon,
  children,
  className,
  ...rest
}: ChipProps): React.JSX.Element {
  const cls = [styles.chip, styles[variant], color ? styles[color] : '', styles[size], selected ? styles.selected : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  const icon = leadingIcon ? <span className={styles.leadingIcon}>{leadingIcon}</span> : null;

  if ('as' in rest && rest.as === 'button') {
    const { as: _as, ...buttonRest } = rest;
    void _as;
    return (
      <Button material="solid" variant="secondary" className={cls} aria-pressed={selected} {...buttonRest}>
        {icon}
        <span className={styles.label}>{children}</span>
      </Button>
    );
  }

  const { as: _as, ...spanRest } = rest as ChipAsSpan;
  void _as;
  return (
    <span className={cls} {...spanRest}>
      {icon}
      <span className={styles.label}>{children}</span>
    </span>
  );
}
