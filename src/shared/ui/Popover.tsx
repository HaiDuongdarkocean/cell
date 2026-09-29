import { useRef } from 'react';
import { Portal } from './Portal';
import { useMenuPlacement, type MenuAlign } from './useMenuPlacement';
import styles from './Popover.module.css';

export interface PopoverProps {
  readonly open: boolean;
  readonly triggerRef: React.RefObject<HTMLElement | null>;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly role?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-activedescendant'?: string;
  /** Pixel cap for the menu height (useful for keeping long lists scrollable). */
  readonly menuMaxHeight?: number;
  /** Preferred horizontal alignment of the menu relative to the trigger.
   *  Falls back to the opposite side when the menu does not fit. */
  readonly menuAlign?: MenuAlign;
}

function getPortalContainer(trigger: HTMLElement | null): Element | DocumentFragment {
  if (!trigger) return document.body;
  const root = trigger.getRootNode();
  if (root instanceof ShadowRoot) {
    const subtitlePanel = trigger.closest('[data-cell-id="subtitle-panel"]');
    if (subtitlePanel) return subtitlePanel;
    return trigger.closest('[data-theme]') ?? root;
  }
  return (root as Document).body ?? document.body;
}

export function Popover({
  open,
  triggerRef,
  children,
  className = '',
  role,
  'aria-label': ariaLabel,
  'aria-activedescendant': ariaActiveDescendant,
  menuMaxHeight,
  menuAlign = 'left',
}: PopoverProps): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);
  const { style } = useMenuPlacement({
    isOpen: open,
    menuAlign,
    menuMaxHeight,
    triggerRef,
    menuRef,
  });
  if (!open) return null;

  return (
    <Portal container={getPortalContainer(triggerRef.current)}>
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
