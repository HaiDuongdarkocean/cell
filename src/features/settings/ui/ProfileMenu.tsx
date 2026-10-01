import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useMenuPlacement } from '@/shared/ui/useMenuPlacement';
import { useDismissOnScroll } from '@/shared/ui/useDismissOnScroll';
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
 * The popover is portaled out of its card (section cards clip children with
 * overflow:hidden), but it must stay inside the same root the trigger lives
 * in: portaling to `ownerDocument.body` from inside a shadow root (Universal
 * Panel settings tab) would land the menu in the page's light DOM — unstyled
 * (module CSS is shadow-scoped) and buried under the panel's z-index.
 * `getPortalContainer` mirrors `Select`: shadow root → topmost child of that
 * root; light DOM / portaled iframe → that document's body.
 * Fixed positioning from the trigger rect + flip-up near the viewport bottom
 * keeps every item reachable. Closes on outside click / Escape / scroll.
 */
export function ProfileMenu({ label, items }: { label: string; items: ProfileMenuItem[] }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { placement, style: placementStyle } = useMenuPlacement({
    isOpen: open,
    menuAlign: 'right',
    triggerRef,
    menuRef,
  });
  const { minWidth: _minWidth, ...menuStyle } = placementStyle;

  const close = useCallback(() => setOpen(false), []);
  useDismissOnScroll(open, menuRef, triggerRef, close);

  useEffect(() => {
    if (!open) return;
    // IMPORTANT: this component may render inside a portaled iframe (showcase)
    // or a shadow root (universal panel) — always resolve document/window and
    // the event scope from the trigger, never the module-level globals.
    const trigger = triggerRef.current;
    const doc = trigger?.ownerDocument ?? document;
    const win = doc.defaultView ?? window;
    const rootNode = trigger?.getRootNode();
    // Inside a shadow root, a document-level listener only sees the retargeted
    // host as e.target, so contains() would fail and the menu would close
    // before any item click lands. Listening on the root scope preserves
    // real targets in both worlds.
    const scope: Document | ShadowRoot = rootNode instanceof ShadowRoot ? rootNode : doc;

    const onDocClick = (e: Event) => {
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
    const onResize = () => setOpen(false);
    scope.addEventListener('mousedown', onDocClick);
    // Shared Escape stack (capture phase): the menu consumes the key before
    // ancestor surfaces (e.g. UniversalPanel) — one Escape, one layer.
    const popEscapeLayer = pushEscapeLayer(onKey, doc);
    win.addEventListener('resize', onResize);

    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    first?.focus();
    return () => {
      scope.removeEventListener('mousedown', onDocClick);
      popEscapeLayer();
      win.removeEventListener('resize', onResize);
    };
  }, [open]);

  /** Portal target stays inside the trigger's root: shadow root → its topmost
   *  element (keeps module CSS + z-index context); light DOM → that
   *  document's body. Same pattern as `Select.getPortalContainer`. */
  const getPortalContainer = (): Element | DocumentFragment => {
    const node = wrapRef.current;
    if (!node) return document.body;
    const root = node.getRootNode();
    if (root instanceof ShadowRoot) {
      let el: Node = node;
      while (el.parentNode && el.parentNode !== root) {
        el = el.parentNode;
      }
      return el instanceof Element ? el : root;
    }
    return (root as Document).body ?? document.body;
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const menuItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    );
    const activeEl = (menuRef.current?.getRootNode() as Document | ShadowRoot | undefined)?.activeElement;
    const idx = menuItems.indexOf(activeEl as HTMLButtonElement);
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
            className={`${styles.menu} ${placement.vpos === 'top' ? styles.menuFlip : ''}`}
            style={menuStyle}
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
          getPortalContainer(),
        )}
    </div>
  );
}
