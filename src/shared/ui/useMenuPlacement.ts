import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

export type MenuAlign = 'left' | 'right' | 'auto';

export interface MenuPlacement {
  /** Horizontal edge of the menu that aligns to the trigger. */
  readonly align: 'left' | 'right';
  /** Whether the menu opens above or below the trigger. */
  readonly vpos: 'bottom' | 'top';
}

export interface UseMenuPlacementOptions {
  /** Whether the menu is currently visible. */
  readonly isOpen: boolean;
  /** Preferred horizontal alignment. `auto` picks the side with more room. */
  readonly menuAlign: MenuAlign;
  /** Optional user-defined cap for the menu height. */
  readonly menuMaxHeight?: number;
  /** Ref to the trigger element. */
  readonly triggerRef: RefObject<HTMLElement | null>;
  /** Ref to the menu element (the listbox). */
  readonly menuRef: RefObject<HTMLElement | null>;
}

export interface UseMenuPlacementResult {
  readonly placement: MenuPlacement;
  /** Pixel cap for the menu width on the chosen side. */
  readonly maxWidth: number;
  /** Pixel cap for the menu height on the chosen side. */
  readonly maxHeight: number;
}

const GAP_FALLBACK = 4; // var(--space-1)
const SPACE_5_FALLBACK = 20; // var(--space-5)
const SPACE_8_FALLBACK = 32; // var(--space-8)

function getViewportSize(): { width: number; height: number } {
  const el = document.documentElement;
  return { width: el.clientWidth, height: el.clientHeight };
}

function readTokenLengthPx(element: HTMLElement | null, token: string, fallback: number): number {
  if (!element) return fallback;
  const raw = getComputedStyle(element).getPropertyValue(token);
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasLayout(rect: DOMRect): boolean {
  return rect.width > 0 || rect.height > 0;
}

/**
 * Compute responsive placement for a dropdown menu.
 *
 * - Picks `top` vs `bottom` based on which side has more viewport space.
 * - Picks `left` vs `right` based on `menuAlign` and whether the menu fits.
 * - Returns pixel caps for width/height so the menu never grows off-screen.
 *
 * ponytail: placement only recomputes on open and window resize. Nested scroll
 * containers and anchor mutation between open/close are not tracked.
 */
export function useMenuPlacement(options: UseMenuPlacementOptions): UseMenuPlacementResult {
  const { isOpen, menuAlign, menuMaxHeight, triggerRef, menuRef } = options;

  const [placement, setPlacement] = useState<MenuPlacement>({
    align: menuAlign === 'right' ? 'right' : 'left',
    vpos: 'bottom',
  });
  const [size, setSize] = useState({
    maxWidth: Number.MAX_SAFE_INTEGER,
    maxHeight: Number.MAX_SAFE_INTEGER,
  });

  const compute = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    // jsdom / hidden elements have zero rects; keep the requested alignment.
    if (!hasLayout(triggerRect) && !hasLayout(menuRect)) {
      setPlacement({ align: menuAlign === 'right' ? 'right' : 'left', vpos: 'bottom' });
      setSize({ maxWidth: Number.MAX_SAFE_INTEGER, maxHeight: Number.MAX_SAFE_INTEGER });
      return;
    }

    const { width: vw, height: vh } = getViewportSize();
    const gap = readTokenLengthPx(menu, '--space-1', GAP_FALLBACK);
    const space5 = readTokenLengthPx(menu, '--space-5', SPACE_5_FALLBACK);
    const viewportMargin = readTokenLengthPx(menu, '--space-8', SPACE_8_FALLBACK);

    const spaceBelow = Math.max(0, vh - triggerRect.bottom - gap);
    const spaceAbove = Math.max(0, triggerRect.top - gap);
    const vpos: 'bottom' | 'top' = spaceBelow >= spaceAbove ? 'bottom' : 'top';
    const verticalSpace = vpos === 'bottom' ? spaceBelow : spaceAbove;

    const spaceRight = Math.max(0, vw - triggerRect.right - gap);
    const spaceLeft = Math.max(0, triggerRect.left - gap);
    const menuWidth = menuRect.width || 0;

    // For left align, the menu grows from trigger.left toward the right edge,
    // so its right edge must stay within the viewport minus the side margin.
    const leftAvailable = vw - triggerRect.left - viewportMargin;
    // For right align, the menu grows left from trigger.right, so its left edge
    // must stay beyond the left viewport edge plus the side margin.
    const rightAvailable = triggerRect.right - viewportMargin;

    let align: 'left' | 'right';
    if (menuAlign === 'left') {
      align = menuWidth <= leftAvailable ? 'left' : 'right';
    } else if (menuAlign === 'right') {
      align = menuWidth <= rightAvailable ? 'right' : 'left';
    } else {
      align = spaceRight >= spaceLeft ? 'right' : 'left';
      if (align === 'left' && menuWidth > leftAvailable) {
        align = 'right';
      } else if (align === 'right' && menuWidth > rightAvailable) {
        align = 'left';
      }
    }

    const horizontalSpace = align === 'left' ? leftAvailable : rightAvailable;

    // Match the CSS fallbacks: menu max is 16×space-5 wide and 11×space-5 tall,
    // and should never exceed half the viewport height.
    const defaultMaxWidth = space5 * 16;
    const defaultMaxHeight = space5 * 11;
    const halfViewport = Math.floor(vh / 2);

    let maxHeight = Math.min(verticalSpace, halfViewport, defaultMaxHeight);
    if (menuMaxHeight !== undefined) {
      maxHeight = Math.min(maxHeight, menuMaxHeight);
    }

    setPlacement({ align, vpos });
    setSize({
      maxWidth: Math.max(Math.min(horizontalSpace, defaultMaxWidth), 0),
      maxHeight: Math.max(maxHeight, 0),
    });
  }, [menuAlign, menuMaxHeight, triggerRef, menuRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    compute();

    const handleResize = (): void => compute();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, compute]);

  return { placement, ...size };
}
