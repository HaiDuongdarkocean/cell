import { useRef } from 'react';
import { Portal } from './Portal';
import { useMenuPlacement } from './useMenuPlacement';
import styles from './Popover.module.css';

export interface PopoverProps {
  readonly open: boolean;
  readonly triggerRef: React.RefObject<HTMLElement | null>;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly role?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-activedescendant'?: string;
}

export function Popover({
  open,
  triggerRef,
  children,
  className = '',
  role,
  'aria-label': ariaLabel,
  'aria-activedescendant': ariaActiveDescendant,
}: PopoverProps): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);
  const { style } = useMenuPlacement({
    isOpen: open,
    menuAlign: 'left',
    triggerRef,
    menuRef,
  });

  if (!open) return null;

  return (
    <Portal>
      <div
        ref={menuRef}
        className={`${styles.popover} ${className}`.trim()}
        style={style}
        role={role}
        aria-label={ariaLabel}
        aria-activedescendant={ariaActiveDescendant}
      >
        {children}
      </div>
    </Portal>
  );
}
