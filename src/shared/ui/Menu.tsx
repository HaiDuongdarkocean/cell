import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Popover } from './Popover';
import { pushEscapeLayer } from './escapeLayerStack';
import type { MenuAlign } from './useMenuPlacement';
import styles from './Menu.module.css';

export interface MenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly triggerRef: React.RefObject<HTMLElement | null>;
  readonly ariaLabel: string;
  readonly children: ReactNode;
  /** Horizontal edge aligned to the trigger. Default `left`. */
  readonly align?: MenuAlign;
  /** Pixel cap for the list height — long lists scroll instead of overflowing. */
  readonly maxHeight?: number;
  /** Render item labels in semibold (bottom-sheet action style). */
  readonly emphasis?: boolean;
}

/**
 * Menu — the canonical dropdown for a list of choices (actions, filters, sorts).
 *
 * Owns the whole behaviour: rounded-rect surface anchored to the trigger,
 * outside-click / Escape / scroll dismissal, and arrow-key roving focus.
 * Call sites only supply items (`MenuItem` / `MenuSeparator`) — never restyle
 * the surface or re-implement dismissal locally.
 */
export function Menu({
  open,
  onClose,
  triggerRef,
  ariaLabel,
  children,
  align = 'left',
  maxHeight,
  emphasis = false,
}: MenuProps): React.JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const doc = triggerRef.current?.ownerDocument ?? document;
    const win = doc.defaultView ?? window;
    const handlePointerDown = (e: Event): void => {
      const path = e.composedPath();
      if (!path.includes(triggerRef.current as Node) && !path.includes(menuRef.current as Node)) {
        onClose();
      }
    };
    const handleScroll = (): void => onClose();
    const rootNode = triggerRef.current?.getRootNode();
    const scope: Document | ShadowRoot = rootNode instanceof ShadowRoot ? rootNode : doc;
    // Shared Escape stack (capture phase): the menu consumes the key before
    // ancestor surfaces (e.g. UniversalPanel) — one Escape, one layer.
    const popEscapeLayer = pushEscapeLayer((e) => {
      e.preventDefault();
      onClose();
      triggerRef.current?.focus();
    }, doc);
    const selected = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (selected ?? menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]'))?.focus();
    doc.addEventListener('mousedown', handlePointerDown);
    win.addEventListener('scroll', handleScroll, true);
    // scroll is non-composed: it never crosses the shadow boundary, so the
    // window listener misses .tab scrolling inside the panel's shadow root.
    if (scope !== doc) scope.addEventListener('scroll', handleScroll, true);
    return () => {
      popEscapeLayer();
      doc.removeEventListener('mousedown', handlePointerDown);
      win.removeEventListener('scroll', handleScroll, true);
      if (scope !== doc) scope.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, onClose, triggerRef]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
      if (!keys.includes(e.key)) return;
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [],
      );
      if (items.length === 0) return;
      e.preventDefault();
      // Inside a shadow root, document.activeElement is the host — the real
      // focused item lives on the root node's activeElement.
      const root = triggerRef.current?.getRootNode();
      const doc = triggerRef.current?.ownerDocument ?? document;
      const scope: Document | ShadowRoot = root instanceof ShadowRoot ? root : doc;
      const active = scope.activeElement as HTMLElement | null;
      const index = active ? items.indexOf(active) : -1;
      const last = items.length - 1;
      const next =
        e.key === 'ArrowDown'
          ? (index + 1) % items.length
          : e.key === 'ArrowUp'
            ? index <= 0
              ? last
              : index - 1
            : e.key === 'Home'
              ? 0
              : last;
      items[next]?.focus();
    },
    [triggerRef],
  );

  return (
    <Popover
      open={open}
      triggerRef={triggerRef}
      contentRef={menuRef}
      variant="menu"
      role="menu"
      className={emphasis ? styles.emphasis : ''}
      aria-label={ariaLabel}
      menuAlign={align}
      menuMaxHeight={maxHeight}
      onKeyDown={handleKeyDown}
    >
      {children}
    </Popover>
  );
}

export interface MenuItemProps {
  readonly children: ReactNode;
  readonly onSelect: () => void;
  /** Leading icon (rendered in a muted slot). */
  readonly icon?: ReactNode;
  /** Trailing slot — counts, check marks. */
  readonly trailing?: ReactNode;
  /** Selection state. With `radio` it maps to `aria-checked` + accent colour. */
  readonly selected?: boolean;
  /** Use `menuitemradio` semantics (single choice inside the menu). */
  readonly radio?: boolean;
  /** Destructive action — label and icon render in error colour. */
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly 'data-cell-id'?: string;
}

export function MenuItem({
  children,
  onSelect,
  icon,
  trailing,
  selected = false,
  radio = false,
  destructive = false,
  disabled = false,
  'data-cell-id': dataCellId,
}: MenuItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      role={radio ? 'menuitemradio' : 'menuitem'}
      aria-checked={radio ? selected : undefined}
      className={`${styles.item}${destructive ? ` ${styles.itemDanger}` : ''}`}
      disabled={disabled}
      onClick={onSelect}
      data-cell-id={dataCellId}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.label}>{children}</span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </button>
  );
}

export function MenuSeparator(): React.JSX.Element {
  return <div className={styles.separator} role="separator" />;
}
