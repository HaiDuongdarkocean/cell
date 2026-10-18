import { useEffect, useRef, type KeyboardEventHandler } from 'react';
import { Portal } from './Portal';
import { useMenuPlacement, type MenuAlign } from './useMenuPlacement';
import { acquireSurfaceLayer } from './surfaceLayer';
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
  /** Portal target override — needed when the surface must stay inside a
   *  high z-index stacking context (e.g. Player Mode overlay). */
  readonly container?: Element | DocumentFragment | null;
  readonly 'data-tihoka-id'?: string;
}

function getPortalContainer(trigger: HTMLElement | null): Element | DocumentFragment {
  if (!trigger) return document.body;
  const root = trigger.getRootNode();
  if (root instanceof ShadowRoot) {
    const subtitlePanel = trigger.closest('[data-tihoka-id="subtitle-panel"]');
    if (subtitlePanel) return subtitlePanel;
    return trigger.closest('[data-theme]') ?? root;
  }
  return (root as Document).body ?? document.body;
}

/** A popover must always render above the surface that opened it — walk the
 *  trigger's composed ancestor chain for the highest z-index and sit above
 *  it (never below the base --z-popover). Fixed layers stop fighting: a menu
 *  inside a z-2000 sheet lands at 2001 automatically. */
function triggeredZIndex(trigger: HTMLElement | null, base: number): number {
  let z = base;
  let n: Element | null = trigger;
  while (n) {
    const v = getComputedStyle(n).zIndex;
    if (v !== 'auto') z = Math.max(z, Number(v) || 0);
    const parent = n.parentElement;
    const root = n.getRootNode();
    n = parent ?? (root instanceof ShadowRoot ? root.host : null);
  }
  return z + 1;
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
  container,
  'data-tihoka-id': dataTihokaId,
}: PopoverProps): React.JSX.Element | null {
  const internalRef = useRef<HTMLDivElement>(null);
  const menuRef = contentRef ?? internalRef;
  useEffect(() => {
    if (!open) return;
    return acquireSurfaceLayer();
  }, [open]);
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
    <Portal container={container ?? getPortalContainer(triggerRef.current)}>
      <div
        ref={menuRef}
        className={cls}
        style={{ ...style, zIndex: triggeredZIndex(triggerRef.current, 1500) }}
        role={role}
        data-tihoka-id={dataTihokaId}
        aria-label={ariaLabel}
        aria-activedescendant={ariaActiveDescendant}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </Portal>
  );
}
