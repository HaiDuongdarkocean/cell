import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent, RefObject } from 'react';

// ─── Sheet atom — shared bottom sheet logic (SSOT) ───
// Extracted from dictionary popup's usePopupPosition sheet logic.
// Used by: Dictionary popup (mobile), SubtitleManager (mobile).
//
// Provides: sheet height state, drag-handle resize (1:1 drag = height),
// content drag-to-dismiss (translateY + snap-back spring), click-on-handle close.

/** Layout constants — synced with popupGeometry.ts. */
const SHEET_MIN_HEIGHT_PX = 200;
const SHEET_DEFAULT_HEIGHT_PX = 300;
const SHEET_MARGIN_PX = 8; // equals --space-2
const SHEET_CLICK_THRESHOLD_PX = 4;
const SHEET_DISMISS_THRESHOLD_PX = 100;
/** Sheet closes when its height drops below this fraction of viewport height. */
const SHEET_DISMISS_RATIO = 0.2;

/** Guard against NaN/negative/non-finite height values from storage or props. */
function safeHeight(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function getClientHeight(): number {
  return document.documentElement?.clientHeight ?? window.innerHeight;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('button, a, input, textarea, select, [role="button"]');
}

interface SheetSession {
  readonly startX: number;
  readonly startY: number;
  readonly startHeight: number;
  readonly fromHandle: boolean;
  readonly target: HTMLElement;
  readonly pointerId: number;
}

export interface UseSheetOptions {
  /** Initial sheet height in px. Default: 300. */
  readonly initialHeight?: number;
  /** Max sheet height in px. Default: viewport - margin. */
  readonly maxHeight?: number;
  /** Called when sheet requests close (drag dismiss, click handle). */
  readonly onClose?: () => void;
  /** Called when sheet height changes (for persistence). */
  readonly onHeightChange?: (height: number) => void;
}

export interface UseSheetResult {
  /** Ref to attach to the sheet container element. */
  readonly sheetRef: RefObject<HTMLDivElement | null>;
  /** Current sheet height in px. */
  readonly sheetHeight: number;
  /** Inline style for the sheet container. */
  readonly style: CSSProperties;
  /** Attach to drag handle element's onPointerDown. */
  readonly onPointerDownHandle: (e: PointerEvent<HTMLDivElement>) => void;
  /** Attach to content element's onPointerDown. */
  readonly onPointerDownContent: (e: PointerEvent<HTMLDivElement>) => void;
}

export function useSheet(options: UseSheetOptions = {}): UseSheetResult {
  const {
    initialHeight = SHEET_DEFAULT_HEIGHT_PX,
    maxHeight,
    onClose,
    onHeightChange,
  } = options;

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onHeightChangeRef = useRef(onHeightChange);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onHeightChangeRef.current = onHeightChange; }, [onHeightChange]);

  const getAvailableHeight = useCallback((): number => {
    if (typeof maxHeight === 'number' && Number.isFinite(maxHeight) && maxHeight > 0) return maxHeight;
    // Subtract 2 margins: bottom (sheet anchor) + top (gap from top edge).
    // Matches CSS max-height: calc(100vh - var(--space-2) * 2).
    return Math.max(0, getClientHeight() - SHEET_MARGIN_PX * 2);
  }, [maxHeight]);

  /** Effective min — clamps to avail on tiny viewports so state/viz never mismatch. */
  const getEffectiveMin = useCallback((): number => {
    return Math.min(SHEET_MIN_HEIGHT_PX, getAvailableHeight());
  }, [getAvailableHeight]);

  const [sheetHeight, setSheetHeight] = useState(() => {
    const avail = getAvailableHeight();
    const init = safeHeight(initialHeight, SHEET_DEFAULT_HEIGHT_PX);
    return Math.max(getEffectiveMin(), Math.min(init, avail));
  });
  const [willChange, setWillChange] = useState<string | undefined>();
  const [transform, setTransform] = useState<string | undefined>();
  const [transition, setTransition] = useState<string | undefined>();

  const sheetHeightRef = useRef(sheetHeight);
  const sessionRef = useRef<SheetSession | null>(null);
  const lastPointerRef = useRef<{ readonly clientX: number; readonly clientY: number } | null>(null);
  const pointerRafRef = useRef<number | null>(null);
  const snapBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { sheetHeightRef.current = sheetHeight; }, [sheetHeight]);

  // Sync to initialHeight when it arrives after mount (e.g. async storage
  // load in HostManagerSheet). useState initializer only runs once, so a
  // late initialHeight prop change must be applied via effect. Guard against
  // 0/NaN and clamp to available range. Skip while a drag session is active
  // (user is actively resizing — don't fight their finger).
  useEffect(() => {
    if (sessionRef.current) return;
    if (typeof initialHeight !== 'number' || !Number.isFinite(initialHeight) || initialHeight <= 0) return;
    const avail = getAvailableHeight();
    const min = getEffectiveMin();
    const next = Math.max(min, Math.min(initialHeight, avail));
    sheetHeightRef.current = next;
    setSheetHeight(next);
  }, [initialHeight, getAvailableHeight, getEffectiveMin]);

  // Recompute on viewport resize.
  useEffect(() => {
    const onResize = (): void => {
      const avail = getAvailableHeight();
      const min = getEffectiveMin();
      const next = Math.max(min, Math.min(sheetHeightRef.current, avail));
      sheetHeightRef.current = next;
      setSheetHeight(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [getAvailableHeight, getEffectiveMin]);

  // Clear snap-back timer on unmount.
  useEffect(() => {
    return () => {
      if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    };
  }, []);

  const endSession = useCallback((clientX: number, clientY: number) => {
    const session = sessionRef.current;
    if (!session) return;
    try { session.target.releasePointerCapture(session.pointerId); } catch { /* ignore */ }
    sessionRef.current = null;
    setWillChange(undefined);
    setTransition(undefined);
    setTransform(undefined);
    lastPointerRef.current = null;

    const dy = clientY - session.startY;
    const vh = getClientHeight();

    if (session.fromHandle) {
      // Click (no meaningful movement) on handle = close.
      const dx = clientX - session.startX;
      if (Math.hypot(dx, dy) <= SHEET_CLICK_THRESHOLD_PX) {
        onCloseRef.current?.();
        return;
      }
      // Drag is 1:1 with height — dismiss if dragged past 20% of vh.
      const rawHeight = session.startHeight - dy;
      if (rawHeight < vh * SHEET_DISMISS_RATIO) {
        onCloseRef.current?.();
        return;
      }
      onHeightChangeRef.current?.(sheetHeightRef.current);
      return;
    }

    // Content drag dismiss.
    if (dy > SHEET_DISMISS_THRESHOLD_PX) {
      onCloseRef.current?.();
      return;
    }
    // Spring back to resting position.
    setTransition('transform var(--duration-normal) var(--ease-spring)');
    setTransform('translateY(0)');
    if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    snapBackTimerRef.current = setTimeout(() => {
      snapBackTimerRef.current = null;
      setTransition(undefined);
      setTransform(undefined);
    }, 200);
  }, []);

  const applyPointerUpdate = useCallback((_clientX: number, clientY: number) => {
    const session = sessionRef.current;
    if (!session) return;
    const dy = clientY - session.startY;
    if (session.fromHandle) {
      // 1:1 drag = height. Sheet anchored at bottom, so growing/shrinking
      // height moves the top edge with the finger.
      const avail = getAvailableHeight();
      const min = getEffectiveMin();
      const next = Math.max(min, Math.min(session.startHeight - dy, avail));
      sheetHeightRef.current = next;
      setSheetHeight(next);
    } else if (dy > 0) {
      setTransform(`translateY(${dy}px)`);
      setTransition('none');
    }
  }, [getAvailableHeight, getEffectiveMin]);

  const onPointerMove = useCallback((e: globalThis.PointerEvent) => {
    if (!sessionRef.current) return;
    lastPointerRef.current = { clientX: e.clientX, clientY: e.clientY };
    if (!pointerRafRef.current) {
      pointerRafRef.current = requestAnimationFrame(() => {
        pointerRafRef.current = null;
        const p = lastPointerRef.current;
        if (p) {
          applyPointerUpdate(p.clientX, p.clientY);
          lastPointerRef.current = null;
        }
      });
    }
  }, [applyPointerUpdate]);

  const onPointerUp = useCallback((e: globalThis.PointerEvent) => {
    if (!sessionRef.current) return;
    if (pointerRafRef.current) {
      cancelAnimationFrame(pointerRafRef.current);
      pointerRafRef.current = null;
      const p = lastPointerRef.current;
      if (p) applyPointerUpdate(p.clientX, p.clientY);
    }
    endSession(e.clientX, e.clientY);
  }, [applyPointerUpdate, endSession]);

  useEffect(() => {
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    return () => {
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
    };
  }, [onPointerMove, onPointerUp]);

  const onPointerDownHandle = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    sessionRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startHeight: sheetHeightRef.current,
      fromHandle: true,
      target,
      pointerId: e.pointerId,
    };
    setWillChange('height');
    try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }, []);

  const onPointerDownContent = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (isInteractiveTarget(e.target)) return;
    if (e.currentTarget.scrollTop > 0) return;
    // Do NOT preventDefault — kills native touch scrolling. Upward drags
    // scroll natively; downward drags at scrollTop=0 trigger dismiss.
    e.stopPropagation();
    sessionRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startHeight: sheetHeightRef.current,
      fromHandle: false,
      target: e.currentTarget,
      pointerId: e.pointerId,
    };
    setWillChange('transform');
  }, []);

  const avail = getAvailableHeight();
  const style: CSSProperties = {
    height: Math.max(getEffectiveMin(), Math.min(sheetHeight, avail)),
    maxHeight: avail,
    willChange,
    transform,
    transition,
  };

  return {
    sheetRef,
    sheetHeight,
    style,
    onPointerDownHandle,
    onPointerDownContent,
  };
}
