import { useMemo, useRef } from 'react';
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
  /** Pixel cap for the menu height (useful for keeping long lists scrollable). */
  readonly menuMaxHeight?: number;
}

function getPortalContainer(trigger: HTMLElement | null): Element | DocumentFragment {
  if (!trigger) return document.body;
  const root = trigger.getRootNode();
  if (root instanceof ShadowRoot) {
    let el: Node | null = trigger;
    while (el && el !== root) {
      if (el instanceof Element && el.getAttribute('data-cell-id') === 'subtitle-panel') {
        return el;
      }
      el = el.parentNode;
    }
    return root;
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
}: PopoverProps): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);
  const { style } = useMenuPlacement({
    isOpen: open,
    menuAlign: 'left',
    menuMaxHeight,
    triggerRef,
    menuRef,
  });
  const container = useMemo(() => getPortalContainer(triggerRef.current), [triggerRef, open]);

  if (!open) return null;

  return (
    <Portal container={container}>
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
