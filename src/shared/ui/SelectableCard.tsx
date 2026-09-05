import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Card } from './Card';

interface SelectableCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Whether this card is the selected option. */
  selected?: boolean;
  /**
   * ARIA role. 'radio' inside a `radiogroup`, 'option' inside a `listbox`,
   * 'button' for standalone activation (e.g. a "New…" placeholder card).
   */
  role?: 'radio' | 'option' | 'button';
  /** Called on click or Enter/Space. */
  onSelect?: () => void;
  children: ReactNode;
}

/**
 * SelectableCard — Card that acts as a keyboard-accessible selectable option.
 *
 * Absorbs the interactive boilerplate (role, tabIndex, Enter/Space, aria-checked)
 * so callers don't hand-roll it on every `<Card variant="interactive">`.
 */
export function SelectableCard({
  selected = false,
  role = 'radio',
  onSelect,
  onClick,
  onKeyDown,
  children,
  ...rest
}: SelectableCardProps): React.JSX.Element {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.();
    }
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>): void => {
    onClick?.(e);
    if (!e.defaultPrevented) onSelect?.();
  };

  return (
    <Card
      variant={selected ? 'selected' : 'interactive'}
      role={role}
      tabIndex={0}
      aria-checked={role !== 'button' ? selected : undefined}
      aria-pressed={role === 'button' ? selected : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </Card>
  );
}
