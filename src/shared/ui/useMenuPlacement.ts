import { useCallback, useLayoutEffect, useState, type RefObject, type CSSProperties } from 'react';
import { getFixedContainingBlock } from '@/shared/lib/dom/getFixedContainingBlock';

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
  /** Positioning styles for a fixed-positioned, portal-rendered menu. */
  readonly style: React.CSSProperties;
}

const GAP_FALLBACK = 4; // var(--space-1)
const SPACE_5_FALLBACK = 20; // var(--space-5)
const SPACE_8_FALLBACK = 32; // var(--space-8)

function readTokenLengthPx(element: HTMLElement | null, token: string, fallback: number): number {
  if (!element) return fallback;
  const raw = getComputedStyle(element).getPropertyValue(token);
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasLayout(rect: DOMRect): boolean {
  return rect.width > 0 || rect.height > 0;
}

interface Bounds {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

function getContainingBlockBounds(element: HTMLElement, win: Window): Bounds {
  const containingBlock = getFixedContainingBlock(element);
  if (!containingBlock) {
    const doc = win.document.documentElement;
    return {
      top: 0,
      right: doc.clientWidth,
      bottom: doc.clientHeight,
      left: 0,
      width: doc.clientWidth,
      height: doc.clientHeight,
    };
  }

  const rect = containingBlock.getBoundingClientRect();
  const top = rect.top + containingBlock.clientTop;
  const left = rect.left + containingBlock.clientLeft;
  return {
    top,
    right: left + containingBlock.clientWidth,
    bottom: top + containingBlock.clientHeight,
    left,
    width: containingBlock.clientWidth,
    height: containingBlock.clientHeight,
  };
}

/**
 * Compute responsive placement for a dropdown menu.
 *
 * - Picks `top` vs `bottom` based on which side has more space in the menu's
 *   fixed-position containing block (usually the viewport, but may be a
 *   transformed/ancestor in shadow or light DOM).
 * - Picks `left` vs `right` based on `menuAlign` and whether the menu fits.
 * - Returns pixel caps for width/height so the menu never grows off-screen.
 * - Offsets are expressed relative to the actual containing block's padding box,
 *   so the menu stays anchored to the trigger even when a transformed ancestor
 *   (e.g. Split View panel) becomes the containing block.
 *
 * ponytail: placement only recomputes on open and window resize. Nested scroll
 * containers and anchor mutation between open/close are not tracked.
 */
export function useMenuPlacement(options: UseMenuPlacementOptions): UseMenuPlacementResult {
  const { isOpen, menuAlign, menuMaxHeight, triggerRef, menuRef } = options;

  const [result, setResult] = useState<UseMenuPlacementResult>({
    placement: { align: menuAlign === 'right' ? 'right' : 'left', vpos: 'bottom' },
    maxWidth: Number.MAX_SAFE_INTEGER,
    maxHeight: Number.MAX_SAFE_INTEGER,
    style: {},
  });

  const compute = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();

    // jsdom / hidden elements have zero rects; keep the requested alignment
    // and a huge but truthy max-height so in-flow tests can read the inline
    // style. Real DOM always has layout, so this path is test-only.
    if (!hasLayout(triggerRect) && !hasLayout(menuRect)) {
      setResult({
        placement: { align: menuAlign === 'right' ? 'right' : 'left', vpos: 'bottom' },
        maxWidth: Number.MAX_SAFE_INTEGER,
        maxHeight: Number.MAX_SAFE_INTEGER,
        style: { maxHeight: Number.MAX_SAFE_INTEGER },
      });
      return;
    }

    const win = trigger.ownerDocument?.defaultView ?? window;
    const bounds = getContainingBlockBounds(menu, win);
    const gap = readTokenLengthPx(menu, '--space-1', GAP_FALLBACK);
    const space5 = readTokenLengthPx(menu, '--space-5', SPACE_5_FALLBACK);
    const viewportMargin = readTokenLengthPx(menu, '--space-8', SPACE_8_FALLBACK);

    const spaceBelow = Math.max(0, bounds.bottom - triggerRect.bottom - gap);
    const spaceAbove = Math.max(0, triggerRect.top - bounds.top - gap);
    const vpos: 'bottom' | 'top' = spaceBelow >= spaceAbove ? 'bottom' : 'top';
    const verticalSpace = vpos === 'bottom' ? spaceBelow : spaceAbove;

    const spaceRight = Math.max(0, bounds.right - triggerRect.right - gap);
    const spaceLeft = Math.max(0, triggerRect.left - bounds.left - gap);
    const menuWidth = menuRect.width || 0;

    // For left align, the menu grows from trigger.left toward the right edge,
    // so its right edge must stay within the containing block minus the side margin.
    const leftAvailable = bounds.right - triggerRect.left - viewportMargin;
    // For right align, the menu grows left from trigger.right, so its left edge
    // must stay beyond the left edge plus the side margin.
    const rightAvailable = triggerRect.right - bounds.left - viewportMargin;

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

    // Menu max size: keep within available containing-block space, and allow tall menus
    // (e.g. 10+ options) while still capping at a reasonable fraction so the user can
    // see the surrounding context.
    const defaultMaxWidth = space5 * 16;
    const defaultMaxHeight = space5 * 22;
    const maxViewportFraction = Math.floor(bounds.height * 0.7);

    let maxHeight = Math.min(verticalSpace, maxViewportFraction, defaultMaxHeight);
    if (menuMaxHeight !== undefined) {
      maxHeight = Math.min(maxHeight, menuMaxHeight);
    }

    const maxWidth = Math.max(Math.min(horizontalSpace, defaultMaxWidth), 0);

    // Build a fixed-position style relative to the actual containing block so the
    // menu can escape clipping/overflow ancestors (dialogs, bottom sheets, scroll
    // containers) without jumping when a transformed ancestor establishes the block.
    const style: CSSProperties = {
      minWidth: Math.round(triggerRect.width),
      maxWidth: maxWidth === Number.MAX_SAFE_INTEGER ? undefined : Math.round(maxWidth),
      maxHeight: Math.round(Math.max(maxHeight, 0)),
    };

    if (vpos === 'bottom') {
      style.top = Math.round(triggerRect.bottom + gap - bounds.top);
    } else {
      style.bottom = Math.round(bounds.bottom - triggerRect.top + gap);
    }

    if (align === 'left') {
      style.left = Math.round(triggerRect.left - bounds.left);
    } else {
      style.right = Math.round(bounds.right - triggerRect.right);
    }

    setResult({
      placement: { align, vpos },
      maxWidth,
      maxHeight: Math.max(maxHeight, 0),
      style,
    });
  }, [menuAlign, menuMaxHeight, triggerRef, menuRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    compute();

    const trigger = triggerRef.current;
    const win = trigger?.ownerDocument?.defaultView ?? window;
    const handleResize = (): void => compute();
    win.addEventListener('resize', handleResize);
    return () => win.removeEventListener('resize', handleResize);
  }, [isOpen, compute, triggerRef]);

  return result;
}
