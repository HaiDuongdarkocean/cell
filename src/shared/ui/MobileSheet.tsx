import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import styles from './MobileSheet.module.css';

/**
 * Snap point of a `MobileSheet`:
 * - `collapsed` — peek height (pill handle, plus an optional 24px header row).
 * - `half` — 50% of the container height.
 * - `full` — 100% of the container height.
 */
export type MobileSheetSnap = 'collapsed' | 'half' | 'full';

const SNAP_ORDER: readonly MobileSheetSnap[] = ['collapsed', 'half', 'full'];
/** Pill drag handle height in px — keep in sync with `.handle` height in the CSS module. */
const PILL_HEIGHT_PX = 32;
/** Extra header row height in px. */
const HEADER_ROW_HEIGHT_PX = 24;
/** Collapsed peek height with a header row. */
const PEEK_HEIGHT_PX = PILL_HEIGHT_PX + HEADER_ROW_HEIGHT_PX;
/** Pointer travel (px) below which a press on the pill counts as a tap. */
const TAP_THRESHOLD_PX = 4;

interface DragSession {
  readonly pointerId: number;
  readonly startY: number;
  readonly startHeight: number;
  readonly containerHeight: number;
  readonly target: HTMLElement;
  moved: boolean;
}

/**
 * Height of the containing block the sheet is anchored to. The sheet is
 * `position: absolute`, so its containing block is the nearest positioned
 * ancestor (`offsetParent`). Falls back to the shadow host (extension
 * context) and then the document viewport so the sheet still works inside
 * the showcase iframe or an unpositioned parent.
 */
function getContainerHeightPx(sheetEl: HTMLElement): number {
  const parent = sheetEl.offsetParent;
  if (parent instanceof HTMLElement && parent.clientHeight > 0) {
    return parent.clientHeight;
  }
  const root = sheetEl.getRootNode();
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    const hostHeight = root.host.clientHeight;
    if (hostHeight > 0) return hostHeight;
  }
  return sheetEl.ownerDocument.documentElement.clientHeight;
}

function snapHeightPx(snap: MobileSheetSnap, containerHeight: number, peekHeight: number): number {
  switch (snap) {
    case 'collapsed': return Math.min(peekHeight, containerHeight);
    case 'half': return containerHeight * 0.5;
    case 'full': return containerHeight;
  }
}

function nearestSnap(heightPx: number, containerHeight: number, peekHeight: number): MobileSheetSnap {
  let best: MobileSheetSnap = 'collapsed';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const snap of SNAP_ORDER) {
    const distance = Math.abs(snapHeightPx(snap, containerHeight, peekHeight) - heightPx);
    if (distance < bestDistance) {
      best = snap;
      bestDistance = distance;
    }
  }
  return best;
}

export interface MobileSheetProps {
  /** Controlled snap point — set 'half' or 'full' to open programmatically.
   *  Omit for uncontrolled usage (see `defaultSnap`). */
  readonly snap?: MobileSheetSnap;
  /** Initial snap point when uncontrolled. Default: 'collapsed'. */
  readonly defaultSnap?: MobileSheetSnap;
  /** Called when the user changes the snap point (pill tap, drag, keyboard). */
  readonly onSnapChange?: (snap: MobileSheetSnap) => void;
  /** Optional header row rendered under the pill — when provided it is shown
   *  in the collapsed peek, increasing the peek height by one row (e.g.
   *  "Create card — {term}"). When omitted, only the drag pill is visible. */
  readonly header?: ReactNode;
  /** Scrollable sheet body. */
  readonly children?: ReactNode;
  /** Accessible name for the sheet region. */
  readonly 'aria-label'?: string;
  /** Accessible label for the pill drag handle. */
  readonly handleAriaLabel?: string;
  /** Extra className for the sheet element (extends styles.sheet). */
  readonly className?: string;
  /** Extra className for the scrollable content area. */
  readonly contentClassName?: string;
  /** Test id for the sheet element. */
  readonly 'data-cell-id'?: string;
}

/**
 * MobileSheet — non-modal bottom sheet with snap points for in-panel layouts
 * (e.g. Card Creator inside the Universal Panel Dictionary tab).
 *
 * Unlike `BottomSheet` (a modal dialog) this sheet anchors to the bottom edge
 * of its containing block — the nearest positioned ancestor — and overlays
 * sibling content. The parent must establish a containing block (e.g.
 * `position: relative`) and a definite height.
 *
 * Behavior:
 * - Three snap points: `collapsed` (handle only, or handle + header when a
 *   header is provided), `half` (50%), `full` (100%) of the container height.
 * - Tap the pill to toggle collapsed ↔ last expanded snap point.
 * - Drag the pill to resize 1:1; release snaps to the nearest point.
 * - Keyboard: Enter/Space toggles, ArrowUp/ArrowDown step, Home/End = max/min.
 * - Pointer capture keeps the drag working inside the showcase iframe and the
 *   extension shadow DOM.
 */
export function MobileSheet({
  snap: snapProp,
  defaultSnap = 'collapsed',
  onSnapChange,
  header,
  children,
  'aria-label': ariaLabel,
  handleAriaLabel = 'Resize sheet. Press Enter to expand or collapse.',
  className,
  contentClassName,
  'data-cell-id': dataTestId,
}: MobileSheetProps): React.JSX.Element {
  const isControlled = snapProp !== undefined;
  const [internalSnap, setInternalSnap] = useState<MobileSheetSnap>(defaultSnap);
  const snap = isControlled ? snapProp : internalSnap;

  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const dragHeightRef = useRef<number | null>(null);
  const snapRef = useRef<MobileSheetSnap>(snap);
  const lastExpandedRef = useRef<MobileSheetSnap>(snap !== 'collapsed' ? snap : 'half');
  const onSnapChangeRef = useRef(onSnapChange);
  const isControlledRef = useRef(isControlled);

  const hasHeader = header !== undefined && header !== null;
  const peekHeight = hasHeader ? PEEK_HEIGHT_PX : PILL_HEIGHT_PX;

  useEffect(() => { onSnapChangeRef.current = onSnapChange; }, [onSnapChange]);
  useEffect(() => { isControlledRef.current = isControlled; }, [isControlled]);
  useEffect(() => {
    snapRef.current = snap;
    if (snap !== 'collapsed') lastExpandedRef.current = snap;
  }, [snap]);

  const applySnap = (next: MobileSheetSnap): void => {
    if (next === snapRef.current) return;
    if (!isControlledRef.current) setInternalSnap(next);
    onSnapChangeRef.current?.(next);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const sheetEl = sheetRef.current;
    if (!sheetEl) return;
    e.preventDefault();
    const target = e.currentTarget;
    const startHeight = sheetEl.getBoundingClientRect().height;
    sessionRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startHeight,
      containerHeight: Math.max(getContainerHeightPx(sheetEl), startHeight),
      target,
      moved: false,
    };
    // Pointer capture delivers move/up to the pill even off-element — works
    // across shadow DOM boundaries without global listeners.
    try { target.setPointerCapture(e.pointerId); } catch { /* jsdom / older browsers */ }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const session = sessionRef.current;
    if (!session || e.pointerId !== session.pointerId) return;
    const dy = e.clientY - session.startY;
    if (!session.moved && Math.abs(dy) <= TAP_THRESHOLD_PX) return;
    session.moved = true;
    // Sheet is anchored at the bottom, so dragging up grows the height 1:1.
    const min = snapHeightPx('collapsed', session.containerHeight, peekHeight);
    const max = snapHeightPx('full', session.containerHeight, peekHeight);
    const next = Math.max(min, Math.min(session.startHeight - dy, max));
    dragHeightRef.current = next;
    setDragHeight(next);
  };

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean): void => {
    const session = sessionRef.current;
    if (!session || e.pointerId !== session.pointerId) return;
    sessionRef.current = null;
    try { session.target.releasePointerCapture(session.pointerId); } catch { /* ignore */ }
    const height = dragHeightRef.current;
    dragHeightRef.current = null;
    setDragHeight(null);
    if (cancelled) return;
    if (!session.moved || height === null) {
      // Tap — toggle between collapsed and the last expanded snap point.
      applySnap(snapRef.current === 'collapsed' ? lastExpandedRef.current : 'collapsed');
      return;
    }
    applySnap(nearestSnap(height, session.containerHeight, peekHeight));
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => finishDrag(e, false);
  const handlePointerCancel = (e: ReactPointerEvent<HTMLDivElement>): void => finishDrag(e, true);
  const handleLostPointerCapture = (e: ReactPointerEvent<HTMLDivElement>): void => finishDrag(e, false);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const current = snapRef.current;
    const index = SNAP_ORDER.indexOf(current);
    let next: MobileSheetSnap | null = null;
    if (e.key === 'Enter' || e.key === ' ') {
      next = current === 'collapsed' ? lastExpandedRef.current : 'collapsed';
    } else if (e.key === 'ArrowUp') {
      next = SNAP_ORDER[Math.min(index + 1, SNAP_ORDER.length - 1)];
    } else if (e.key === 'ArrowDown') {
      next = SNAP_ORDER[Math.max(index - 1, 0)];
    } else if (e.key === 'Home') {
      next = 'full';
    } else if (e.key === 'End') {
      next = 'collapsed';
    }
    if (next === null) return;
    e.preventDefault();
    applySnap(next);
  };

  const snapClass = snap === 'full' ? styles.snapFull : snap === 'half' ? styles.snapHalf : styles.snapCollapsed;
  const sheetClass = [styles.sheet, snapClass, dragHeight !== null ? styles.dragging : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const sheetStyle: CSSProperties = {
    '--mobile-sheet-peek-height': `${peekHeight}px`,
    ...(dragHeight !== null ? { '--mobile-sheet-drag-height': `${dragHeight}px` } : {}),
  } as CSSProperties;
  const contentClass = contentClassName ? `${styles.content} ${contentClassName}` : styles.content;

  return (
    <section
      ref={sheetRef}
      className={sheetClass}
      style={sheetStyle}
      aria-label={ariaLabel}
      data-cell-id={dataTestId}
    >
      <div
        className={styles.handle}
        role="button"
        tabIndex={0}
        aria-label={handleAriaLabel}
        aria-expanded={snap !== 'collapsed'}
        data-cell-id="card-creator-sheet-pill"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.pill} aria-hidden="true" />
      </div>
      {header !== undefined && header !== null && (
        <div className={styles.header}>{header}</div>
      )}
      <div className={contentClass}>{children}</div>
    </section>
  );
}
