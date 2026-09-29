import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Popover } from './Popover';
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
    const handleKeyDown = (e: Event): void => {
      if ((e as globalThis.KeyboardEvent).key === 'Escape') onClose();
    };
    doc.addEventListener('mousedown', handlePointerDown);
    doc.addEventListener('keydown', handleKeyDown);
    win.addEventListener('scroll', handleScroll, true);
    return () => {
      doc.removeEventListener('mousedown', handlePointerDown);
      doc.removeEventListener('keydown', handleKeyDown);
      win.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, onClose, triggerRef]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>): void => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [],
    );
    if (items.length === 0) return;
    e.preventDefault();
    const active = menuRef.current?.ownerDocument.activeElement as HTMLElement | null;
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
  }, []);

  return (
    <Popover
      open={open}
      triggerRef={triggerRef}
      contentRef={menuRef}
      variant="menu"
      role="menu"
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
  disabled = false,
  'data-cell-id': dataCellId,
}: MenuItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      role={radio ? 'menuitemradio' : 'menuitem'}
      aria-checked={radio ? selected : undefined}
      className={styles.item}
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
