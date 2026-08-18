import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Button } from './Button';
import styles from './FooterBar.module.css';

export interface FooterBarSlot {
  /** Unique key for React list rendering. */
  readonly key: string;
  /** Icon element rendered above label (vertical orientation). */
  readonly icon: ReactNode;
  /** Label text rendered below icon. */
  readonly label: ReactNode;
  /** Button variant. Navigation slots use 'ghost'; primary action uses 'primarySubtle'. */
  readonly variant?: 'ghost' | 'primarySubtle';
  /** Active toggle state — pale-blue subtle background + primary color. */
  readonly active?: boolean;
  /** One-shot ripple pulse: icon+label flash to primary color while ripple spreads, then revert. */
  readonly ripplePulse?: boolean;
  /** Disabled state. */
  readonly disabled?: boolean;
  /** Click handler. */
  readonly onClick: () => void;
  /** Ref forwarded to underlying button. */
  readonly ref?: React.Ref<HTMLButtonElement>;
  /** Extra button attributes (title, data-cell-id, aria-*). */
  readonly buttonProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'ref'>;
}

export interface FooterBarProps {
  /** Navigation slots — evenly divided, edge-to-edge. */
  readonly slots: readonly FooterBarSlot[];
  /** Extra class on container. */
  readonly className?: string;
}

/**
 * FooterBar — generic bottom navigation bar (ZaloPay / iOS tab bar / Material 3 pattern).
 * Equal-width slots, flat (no border-radius), soft shadow separator, height = content.
 */
export function FooterBar({ slots, className }: FooterBarProps): React.JSX.Element {
  const cls = [styles.footer, className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      {slots.map((slot) => (
        <Button
          key={slot.key}
          variant={slot.variant ?? 'ghost'}
          orientation="vertical"
          active={slot.active}
          activeStyle="flat"
          ripple
          ripplePulse={slot.ripplePulse}
          disabled={slot.disabled}
          ref={slot.ref}
          onClick={slot.onClick}
          leadingIcon={slot.icon}
          {...slot.buttonProps}
        >
          {slot.label}
        </Button>
      ))}
    </div>
  );
}
