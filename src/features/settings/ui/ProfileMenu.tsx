import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
import type { IconCatalogKey } from '@/shared/icons';
import styles from './LanguageProfilePanel.module.css';

export interface ProfileMenuItem {
  readonly key: string;
  readonly label: string;
  readonly icon?: IconCatalogKey;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

/**
 * ProfileMenu — ⋮ trigger + popover action list for one profile card.
 *
 * The popover is portaled to the trigger's ownerDocument.body: section cards
 * clip their children (overflow:hidden for the radius), so an in-tree menu
 * would be cut. ownerDocument (not the global document) keeps it working when
 * the panel is itself portaled into an iframe, as in the design showcase.
 * Fixed positioning from the trigger rect + flip-up near the viewport bottom
 * keeps every item reachable. Closes on outside click / Escape / scroll.
 */
export function ProfileMenu({ label, items }: { label: string; items: ProfileMenuItem[] }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // IMPORTANT: this component may render inside a portaled iframe (showcase)
    // — always resolve document/window from the trigger's ownerDocument,
    // never the module-level globals.
    const doc = triggerRef.current?.ownerDocument ?? document;
    const win = doc.defaultView ?? window;

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!wrapRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // Close on scroll — a fixed popover would detach from its trigger.
    const onScroll = () => setOpen(false);
    doc.addEventListener('mousedown', onDocClick);
    // Shared Escape stack (capture phase): the menu consumes the key before
    // ancestor surfaces (e.g. UniversalPanel) — one Escape, one layer.
    const popEscapeLayer = pushEscapeLayer(onKey, doc);
    win.addEventListener('scroll', onScroll, true);
    win.addEventListener('resize', onScroll);

    // Measure once mounted: right-align to the trigger, flip up when the
    // menu would overflow the viewport bottom.
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (menu && trigger) {
      const tr = trigger.getBoundingClientRect();
      const mr = menu.getBoundingClientRect();
      const gap = 8;
      const flipUp = tr.bottom + gap + mr.height > win.innerHeight - gap;
      setPos({
        top: flipUp ? tr.top - mr.height - gap : tr.bottom + gap,
        left: Math.max(gap, tr.right - mr.width),
        flip: flipUp,
      });
    }

    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    first?.focus();
    return () => {
      doc.removeEventListener('mousedown', onDocClick);
      popEscapeLayer();
      win.removeEventListener('scroll', onScroll, true);
      win.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const menuItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );
    const idx = menuItems.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
    menuItems[(next + menuItems.length) % menuItems.length]?.focus();
  };

  return (
    <div className={styles.menuWrap} ref={wrapRef}>
      <Button
        ref={triggerRef}
        shape="circle"
        type="button"
        size="sm"
        variant="ghost"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="ellipsisVertical" size="xs" />
      </Button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className={`${styles.menu} ${pos?.flip ? styles.menuFlip : ''}`}
            style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
            role="menu"
            onKeyDown={onMenuKeyDown}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${item.danger ? styles.menuItemDanger : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon && <Icon name={item.icon} size="xs" />}
                {item.label}
              </button>
            ))}
          </div>,
          wrapRef.current?.ownerDocument.body ?? document.body,
        )}
    </div>
  );
}
