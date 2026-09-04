import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent, RefObject } from 'react';
import {
  clampPopupSize,
  computePopupPosition,
  finalizePosition,
  POPUP_DEFAULT_HEIGHT_PX,
  POPUP_MARGIN_PX,
  POPUP_MIN_HEIGHT_PX,
  POPUP_MIN_WIDTH_PX,
  POPUP_SHEET_BREAKPOINT_PX,
  POPUP_Z_INDEX,
  popupOverlapsAnchor,
  SHEET_CLICK_THRESHOLD_PX,
  SHEET_DISMISS_RATIO,
  SHEET_DISMISS_THRESHOLD_PX,
  type PopupAnchor,
  type PopupLineRect,
  type PopupPointerHint,
  type PopupPosition,
  type PopupSize,
} from './popupGeometry';

export type { PopupAnchor, PopupLineRect, PopupPointerHint, PopupPosition, PopupSize };

export interface UsePopupPositionOptions {
  readonly anchor: PopupAnchor;
  readonly pointer?: PopupPointerHint;
  readonly lineRect?: PopupLineRect | null;
  readonly initialSize?: Partial<PopupSize>;
  readonly initialSheetHeight?: number;
  readonly onSizeChange?: (size: PopupSize, sheetHeight: number) => void;
  readonly onClose?: () => void;
}

function getClientWidth(): number {
  return document.documentElement?.clientWidth ?? window.innerWidth;
}

function getClientHeight(): number {
  return document.documentElement?.clientHeight ?? window.innerHeight;
}

interface PlayerModeBounds {
  readonly top: number;
  readonly bottom: number;
}

function getPlayerModeBounds(): PlayerModeBounds | null {
  if (document.documentElement?.dataset.cellPlayerMode !== 'true') return null;
  const rootStyle = getComputedStyle(document.documentElement);
  const top = Number.parseFloat(rootStyle.getPropertyValue('--cell-player-mode-video-height'));
  const bottom = Number.parseFloat(rootStyle.getPropertyValue('--cell-player-mode-dock-height'));
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || top < 0 || bottom < 0) return null;
  return { top, bottom };
}

function getSheetAvailableHeight(viewportHeight: number): number {
  const bounds = getPlayerModeBounds();
  if (!bounds) return viewportHeight - POPUP_MARGIN_PX;
  // Player Mode: sheet is anchored above the dock and can grow upward to cover
  // the video stage. Only the dock is reserved — video can be covered.
  return Math.max(viewportHeight - bounds.bottom, 0);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('button, a, input, textarea, select, [role="button"]');
}

interface DragSession {
  readonly type: 'drag';
  readonly startX: number;
  readonly startY: number;
  readonly startOffset: PopupPosition;
  readonly cachedWidth: number;
  readonly cachedHeight: number;
  readonly cachedVw: number;
  readonly cachedVh: number;
  readonly target: HTMLElement;
  readonly pointerId: number;
}

interface ResizeSession {
  readonly type: 'resize';
  readonly startX: number;
  readonly startY: number;
  readonly startWidth: number;
  readonly startHeight: number;
}

interface SheetSession {
  readonly type: 'sheet';
  readonly startX: number;
  readonly startY: number;
  readonly startHeight: number;
  readonly fromHandle: boolean;
  readonly target: HTMLElement;
  readonly pointerId: number;
}

type Session = DragSession | ResizeSession | SheetSession;

export function usePopupPosition(options: UsePopupPositionOptions): {
  readonly style: CSSProperties;
  readonly isSheet: boolean;
  readonly popupRef: RefObject<HTMLDivElement | null>;
  readonly onPointerDownHeader: (e: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerDownResize: (e: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerDownSheet: (e: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerDownContent: (e: PointerEvent<HTMLDivElement>) => void;
} {
  const {
    anchor,
    pointer,
    lineRect,
    initialSize,
    initialSheetHeight,
    onSizeChange,
    onClose,
  } = options;

  const popupRef = useRef<HTMLDivElement | null>(null);

  const anchorRef = useRef(anchor);
  const pointerRef = useRef(pointer);
  const lineRectRef = useRef(lineRect ?? null);
  const onSizeChangeRef = useRef(onSizeChange);
  const onCloseRef = useRef(onClose);

  useEffect(() => { anchorRef.current = anchor; }, [anchor]);
  useEffect(() => { pointerRef.current = pointer; }, [pointer]);
  useEffect(() => { lineRectRef.current = lineRect ?? null; }, [lineRect]);
  useEffect(() => { onSizeChangeRef.current = onSizeChange; }, [onSizeChange]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const getVw = useCallback(() => getClientWidth(), []);
  const getVh = useCallback(() => getClientHeight(), []);

  const buildInitialSize = useCallback((): PopupSize => {
    const vw = getVw();
    const vh = getVh();
    return clampPopupSize(
      {
        width: initialSize?.width ?? 420,
        maxHeight: initialSize?.maxHeight ?? POPUP_DEFAULT_HEIGHT_PX,
      },
      vw,
      vh,
    );
  }, [getVw, getVh, initialSize?.width, initialSize?.maxHeight]);

  const [isSheet, setIsSheet] = useState(() => getVw() < POPUP_SHEET_BREAKPOINT_PX);
  const [size, setSize] = useState<PopupSize>(buildInitialSize);
  const [sheetHeight, setSheetHeight] = useState(() => {
    const bounds = getPlayerModeBounds();
    // Player Mode: initial sheet height = middle area (between video and dock).
    // Max height (when dragged up) = viewport - dock (can cover video).
    const initial = bounds
      ? Math.max(POPUP_MIN_HEIGHT_PX, getVh() - bounds.top - bounds.bottom)
      : (initialSheetHeight ?? POPUP_DEFAULT_HEIGHT_PX);
    return Math.max(
      POPUP_MIN_HEIGHT_PX,
      Math.min(initial, getSheetAvailableHeight(getVh())),
    );
  });
  const [position, setPosition] = useState<PopupPosition>(() => {
    const vw = getVw();
    const vh = getVh();
    const s = buildInitialSize();
    // CSS height = min(maxHeight, vh - top - margin) — always maxHeight when
    // space allows. Position must be computed with maxHeight so the corner
    // placement matches the rendered height (otherwise popup covers anchor).
    return computePopupPosition(
      anchor.top,
      anchor.left,
      anchor.right,
      anchor.bottom,
      s.width,
      vw,
      vh,
      s.maxHeight,
      pointer,
      lineRect ?? null,
    );
  });
  const [willChange, setWillChange] = useState<string | undefined>();
  const [transform, setTransform] = useState<string | undefined>();
  const [transition, setTransition] = useState<string | undefined>();

  const sizeRef = useRef(size);
  const sheetHeightRef = useRef(sheetHeight);
  const positionRef = useRef(position);
  const isSheetRef = useRef(isSheet);
  const dragOffsetRef = useRef<PopupPosition>({ left: 0, top: 0 });
  const sessionRef = useRef<Session | null>(null);
  const lastPointerRef = useRef<{ readonly clientX: number; readonly clientY: number } | null>(null);
  const pointerRafRef = useRef<number | null>(null);
  const viewportRafRef = useRef<number | null>(null);
  const snapBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { sheetHeightRef.current = sheetHeight; }, [sheetHeight]);
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { isSheetRef.current = isSheet; }, [isSheet]);

  const computeAndClampPosition = useCallback(
    (
      nextSize: PopupSize,
      offset: PopupPosition,
      vw: number,
      vh: number,
    ): PopupPosition => {
      // CSS height = min(maxHeight, vh - top - margin) — always maxHeight when
      // space allows. Position must be computed with maxHeight so the corner
      // placement matches the rendered height (otherwise popup covers anchor).
      const base = computePopupPosition(
        anchorRef.current.top,
        anchorRef.current.left,
        anchorRef.current.right,
        anchorRef.current.bottom,
        nextSize.width,
        vw,
        vh,
        nextSize.maxHeight,
        pointerRef.current,
        lineRectRef.current,
      );
      return finalizePosition(
        base.left + offset.left,
        base.top + offset.top,
        nextSize.width,
        nextSize.maxHeight,
        vw,
        vh,
      );
    },
    [],
  );

  const endSession = useCallback((clientX: number, clientY: number) => {
    const session = sessionRef.current;
    if (!session) return;

    if (session.type === 'drag') {
      try { session.target.releasePointerCapture(session.pointerId); } catch { /* ignore */ }
    } else if (session.type === 'sheet') {
      try { session.target.releasePointerCapture(session.pointerId); } catch { /* ignore */ }
    }

    sessionRef.current = null;
    setWillChange(undefined);
    setTransition(undefined);
    setTransform(undefined);
    lastPointerRef.current = null;

    if (session.type === 'resize') {
      onSizeChangeRef.current?.(sizeRef.current, sheetHeightRef.current);
      return;
    }

    if (session.type !== 'sheet') return;

    const dy = clientY - session.startY;
    const vh = getClientHeight();

    if (session.fromHandle) {
      // Click (no meaningful movement) on the handle = close.
      const dx = clientX - session.startX;
      if (Math.hypot(dx, dy) <= SHEET_CLICK_THRESHOLD_PX) {
        onCloseRef.current?.();
        return;
      }
      // Drag is 1:1 with height, so the live height is already where the user
      // stopped. Use the raw (pre-MIN-clamp) projected height for the dismiss
      // decision — the visual is clamped to MIN so the sheet never vanishes,
      // but the user's intent (drag past 20% of vh) still triggers close.
      const rawHeight = session.startHeight - dy;
      if (rawHeight < vh * SHEET_DISMISS_RATIO) {
        onCloseRef.current?.();
        return;
      }
      const finalHeight = sheetHeightRef.current;
      onSizeChangeRef.current?.(sizeRef.current, finalHeight);
      return;
    }

    if (dy > SHEET_DISMISS_THRESHOLD_PX) {
      onCloseRef.current?.();
      return;
    }
    // Sheet content drag released above dismiss threshold — spring back to
    // resting position instead of snapping instantly. --ease-spring gives a
    // subtle overshoot that feels like iOS sheet physics. Mirrors --duration-200.
    setTransition('transform var(--duration-200) var(--ease-spring)');
    setTransform('translateY(0)');
    if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    snapBackTimerRef.current = setTimeout(() => {
      snapBackTimerRef.current = null;
      setTransition(undefined);
      setTransform(undefined);
    }, 200);
  }, []);

  const applyPointerUpdate = useCallback((clientX: number, clientY: number) => {
    const session = sessionRef.current;
    if (!session) return;

    if (session.type === 'drag') {
      const dx = clientX - session.startX;
      const dy = clientY - session.startY;
      const offset: PopupPosition = {
        left: session.startOffset.left + dx,
        top: session.startOffset.top + dy,
      };
      dragOffsetRef.current = offset;
      const pos = computeAndClampPosition(
        sizeRef.current,
        offset,
        session.cachedVw,
        session.cachedVh,
      );
      // Use the cached drag dims for final clamp; computeAndClampPosition uses
      // current size which is stable during a drag.
      const clamped = finalizePosition(
        pos.left,
        pos.top,
        session.cachedWidth,
        session.cachedHeight,
        session.cachedVw,
        session.cachedVh,
      );
      setPosition(clamped);
      return;
    }

    if (session.type === 'resize') {
      const vh = getClientHeight();
      if (isSheetRef.current) {
        const dy = clientY - session.startY;
        const next = Math.max(
          POPUP_MIN_HEIGHT_PX,
          Math.min(session.startHeight - dy, getSheetAvailableHeight(vh)),
        );
        sheetHeightRef.current = next;
        setSheetHeight(next);
      } else {
        const vw = getClientWidth();
        const dx = clientX - session.startX;
        const dy = clientY - session.startY;
        const next = clampPopupSize(
          {
            width: Math.max(POPUP_MIN_WIDTH_PX, session.startWidth + dx),
            maxHeight: Math.max(POPUP_MIN_HEIGHT_PX, session.startHeight + dy),
          },
          vw,
          vh,
        );
        sizeRef.current = next;
        setSize(next);
        const pos = computeAndClampPosition(next, dragOffsetRef.current, vw, vh);
        setPosition(pos);
      }
      return;
    }

    // sheet
    const dy = clientY - session.startY;
    if (session.fromHandle) {
      // 1:1 drag = height. Sheet is anchored at the bottom, so growing/shrinking
      // height moves the top edge (where the handle sits) with the finger. The
      // stop position IS the sheet height — no snap, no translate.
      const vh = getClientHeight();
      const next = Math.max(
        POPUP_MIN_HEIGHT_PX,
        Math.min(session.startHeight - dy, getSheetAvailableHeight(vh)),
      );
      sheetHeightRef.current = next;
      setSheetHeight(next);
    } else if (dy > 0) {
      setTransform(`translateY(${dy}px)`);
      setTransition('none');
    }
  }, [computeAndClampPosition]);

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

  useEffect(() => {
    const onResize = () => {
      if (viewportRafRef.current) return;
      viewportRafRef.current = requestAnimationFrame(() => {
        viewportRafRef.current = null;
        const vw = getClientWidth();
        const vh = getClientHeight();
        const sheet = vw < POPUP_SHEET_BREAKPOINT_PX;
        setIsSheet(sheet);
        const nextSize = clampPopupSize(sizeRef.current, vw, vh);
        sizeRef.current = nextSize;
        setSize(nextSize);

        if (sheet) {
          const next = Math.max(
            POPUP_MIN_HEIGHT_PX,
            Math.min(sheetHeightRef.current, getSheetAvailableHeight(vh)),
          );
          sheetHeightRef.current = next;
          setSheetHeight(next);
        } else {
          const pos = computeAndClampPosition(nextSize, dragOffsetRef.current, vw, vh);
          setPosition(pos);
        }
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computeAndClampPosition]);

  useEffect(() => {
    return () => {
      if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    const vw = getClientWidth();
    const vh = getClientHeight();
    let sheet = vw < POPUP_SHEET_BREAKPOINT_PX;

    const nextSize = clampPopupSize(sizeRef.current, vw, vh);
    sizeRef.current = nextSize;
    setSize(nextSize);
    dragOffsetRef.current = { left: 0, top: 0 };
    setTransform(undefined);
    setTransition(undefined);

    if (sheet) {
      setIsSheet(true);
      const next = Math.max(
        POPUP_MIN_HEIGHT_PX,
        Math.min(sheetHeightRef.current, getSheetAvailableHeight(vh)),
      );
      sheetHeightRef.current = next;
      setSheetHeight(next);
    } else {
      const pos = computeAndClampPosition(nextSize, { left: 0, top: 0 }, vw, vh);
      // Fallback: if desktop popup can't avoid covering the anchor word,
      // the viewport is too cramped for corner placement — switch to sheet.
      if (popupOverlapsAnchor(pos, nextSize.width, nextSize.maxHeight, anchorRef.current)) {
        sheet = true;
        setIsSheet(true);
        const next = Math.max(
          POPUP_MIN_HEIGHT_PX,
          Math.min(sheetHeightRef.current, getSheetAvailableHeight(vh)),
        );
        sheetHeightRef.current = next;
        setSheetHeight(next);
      } else {
        setIsSheet(false);
        setPosition(pos);
      }
    }
  }, [
    anchor,
    pointer,
    lineRect,
    computeAndClampPosition,
  ]);

  const startWillChange = useCallback(() => {
    setWillChange('left, top, width, height');
  }, []);

  const onPointerDownHeader = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (isSheetRef.current) return;
    if (isInteractiveTarget(e.target)) return;
    e.preventDefault();
    const target = e.currentTarget;
    const rect = popupRef.current?.getBoundingClientRect();
    const vw = getClientWidth();
    const vh = getClientHeight();
    sessionRef.current = {
      type: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      startOffset: dragOffsetRef.current,
      cachedWidth: rect?.width ?? sizeRef.current.width,
      cachedHeight: rect?.height ?? sizeRef.current.maxHeight,
      cachedVw: vw,
      cachedVh: vh,
      target,
      pointerId: e.pointerId,
    };
    startWillChange();
    try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }, [startWillChange]);

  const onPointerDownResize = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const startHeight = popupRef.current?.offsetHeight ??
      (isSheetRef.current ? sheetHeightRef.current : sizeRef.current.maxHeight);
    sessionRef.current = {
      type: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      startWidth: isSheetRef.current ? getClientWidth() : sizeRef.current.width,
      startHeight,
    };
    startWillChange();
  }, [startWillChange]);

  const onPointerDownSheet = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!isSheetRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    sessionRef.current = {
      type: 'sheet',
      startX: e.clientX,
      startY: e.clientY,
      startHeight: sheetHeightRef.current,
      fromHandle: true,
      target,
      pointerId: e.pointerId,
    };
    startWillChange();
    try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }, [startWillChange]);

  const onPointerDownContent = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!isSheetRef.current) return;
    if (isInteractiveTarget(e.target)) return;
    if (e.currentTarget.scrollTop > 0) return;
    // Do NOT preventDefault or setPointerCapture here. Doing so kills native
    // touch scrolling — the user can never scroll content up from the top
    // because preventDefault blocks the browser's scroll gesture and dy<0
    // (upward drag) is ignored by applyPointerUpdate. Without preventDefault,
    // upward drags scroll natively; downward drags at scrollTop=0 can't scroll
    // (overscroll-behavior:contain) so only our translateY dismiss fires.
    e.stopPropagation();
    sessionRef.current = {
      type: 'sheet',
      startX: e.clientX,
      startY: e.clientY,
      startHeight: sheetHeightRef.current,
      fromHandle: false,
      target: e.currentTarget,
      pointerId: e.pointerId,
    };
    startWillChange();
  }, [startWillChange]);

  const playerModeBounds = getPlayerModeBounds();
  const sheetAvailableHeight = getSheetAvailableHeight(getClientHeight());
  // Player Mode: sheet anchored above dock, grows upward to cover video.
  // top = max(0, viewport - dock - sheetHeight) so small sheets sit in the
  // middle area, tall sheets grow up to cover the video stage (top → 0).
  const sheetTop = playerModeBounds
    ? Math.max(0, getClientHeight() - playerModeBounds.bottom - Math.min(sheetHeight, sheetAvailableHeight))
    : 'auto';
  const style: CSSProperties = isSheet
    ? {
        position: 'fixed',
        left: '3%',
        right: '3%',
        top: sheetTop,
        bottom: playerModeBounds?.bottom ?? 'var(--space-2)',
        width: '94%',
        height: Math.max(
          POPUP_MIN_HEIGHT_PX,
          Math.min(sheetHeight, sheetAvailableHeight),
        ),
        maxHeight: sheetAvailableHeight,
        zIndex: POPUP_Z_INDEX,
        willChange,
        transform,
        transition,
      }
    : {
        position: 'fixed',
        left: position.left,
        top: position.top,
        width: size.width,
        height: Math.max(
          POPUP_MIN_HEIGHT_PX,
          Math.min(
            size.maxHeight,
            getClientHeight() - position.top - POPUP_MARGIN_PX,
          ),
        ),
        maxHeight: size.maxHeight,
        zIndex: POPUP_Z_INDEX,
        willChange,
        transform,
        transition,
      };

  return {
    style,
    isSheet,
    popupRef,
    onPointerDownHeader,
    onPointerDownResize,
    onPointerDownSheet,
    onPointerDownContent,
  };
}
