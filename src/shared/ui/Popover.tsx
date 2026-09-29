import { useRef, type KeyboardEventHandler } from 'react';
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
  /**
   * Surface shape. `toolbar` (default) is a horizontal pill for button groups;
   * `menu` is a rounded-rect vertical list for choices. Menus should go through
   * `<Menu>` rather than using this directly.
   */
  readonly variant?: 'toolbar' | 'menu';
  /** External ref to the surface element — lets callers own dismiss/keyboard logic. */
  readonly contentRef?: React.RefObject<HTMLDivElement | null>;
  readonly onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
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
  variant = 'toolbar',
  contentRef,
  onKeyDown,
}: PopoverProps): React.JSX.Element | null {
  const internalRef = useRef<HTMLDivElement>(null);
  const menuRef = contentRef ?? internalRef;
  const { style } = useMenuPlacement({
    isOpen: open,
    menuAlign,
    menuMaxHeight,
    triggerRef,
    menuRef,
  });
  if (!open) return null;

  const cls = [styles.popover, variant === 'menu' ? styles.menu : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Portal container={getPortalContainer(triggerRef.current)}>
      <div
        ref={menuRef}
        className={cls}
        style={style}
        role={role}
        aria-label={ariaLabel}
        aria-activedescendant={ariaActiveDescendant}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </Portal>
  );
}
