import { useCallback, useEffect, useRef, useState } from 'react';
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
  SHEET_DISMISS_THRESHOLD_PX,
  SHEET_TIERS,
  type PopupAnchor,
  type PopupLineRect,
  type PopupPointerHint,
  type PopupPosition,
  type PopupSize,
} from './popupShell';

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

function getRenderedHeight(popup: HTMLDivElement | null, size: PopupSize): number {
  if (popup && popup.offsetHeight > 0) {
    return Math.min(popup.offsetHeight, size.maxHeight);
  }
  return Math.min(size.maxHeight, POPUP_DEFAULT_HEIGHT_PX);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('button, a, input, textarea, select, [role="button"]');
}

function snapSheetToTier(startHeight: number, dy: number, vh: number): number {
  const targetHeight = startHeight - dy;
  const tierHeights = SHEET_TIERS.map((t) => Math.round(vh * t));
  let best = tierHeights[0]!;
  let minDiff = Infinity;
  for (const h of tierHeights) {
    const diff = Math.abs(h - targetHeight);
    if (diff < minDiff) {
      minDiff = diff;
      best = h;
    }
  }
  return Math.max(POPUP_MIN_HEIGHT_PX, Math.min(best, vh - POPUP_MARGIN_PX));
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
  const [sheetHeight, setSheetHeight] = useState(() =>
    Math.max(
      POPUP_MIN_HEIGHT_PX,
      Math.min(
        initialSheetHeight ?? POPUP_DEFAULT_HEIGHT_PX,
        getVh() - POPUP_MARGIN_PX,
      ),
    ),
  );
  const [position, setPosition] = useState<PopupPosition>(() => {
    const vw = getVw();
    const vh = getVh();
    const s = buildInitialSize();
    const h = getRenderedHeight(null, s);
    return computePopupPosition(
      anchor.top,
      anchor.left,
      anchor.right,
      anchor.bottom,
      s.width,
      vw,
      vh,
      h,
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
      const h = getRenderedHeight(popupRef.current, nextSize);
      const base = computePopupPosition(
        anchorRef.current.top,
        anchorRef.current.left,
        anchorRef.current.right,
        anchorRef.current.bottom,
        nextSize.width,
        vw,
        vh,
        h,
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

  const endSession = useCallback((_clientX: number, clientY: number) => {
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
      if (dy > SHEET_DISMISS_THRESHOLD_PX) {
        onCloseRef.current?.();
        return;
      }
      const next = snapSheetToTier(session.startHeight, dy, vh);
      setSheetHeight(next);
      onSizeChangeRef.current?.(sizeRef.current, next);
      return;
    }

    if (dy > SHEET_DISMISS_THRESHOLD_PX) {
      onCloseRef.current?.();
    }
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
          Math.min(session.startHeight - dy, vh - POPUP_MARGIN_PX),
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
      if (dy > 0) {
        setTransform(`translateY(${dy}px)`);
        setTransition('none');
      } else {
        const vh = getClientHeight();
        const next = Math.max(
          POPUP_MIN_HEIGHT_PX,
          Math.min(session.startHeight - dy, vh - POPUP_MARGIN_PX),
        );
        sheetHeightRef.current = next;
        setSheetHeight(next);
        setTransform(undefined);
        setTransition(undefined);
      }
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
            Math.min(sheetHeightRef.current, vh - POPUP_MARGIN_PX),
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
    const vw = getClientWidth();
    const vh = getClientHeight();
    const sheet = vw < POPUP_SHEET_BREAKPOINT_PX;
    setIsSheet(sheet);

    const nextSize = clampPopupSize(sizeRef.current, vw, vh);
    sizeRef.current = nextSize;
    setSize(nextSize);
    dragOffsetRef.current = { left: 0, top: 0 };
    setTransform(undefined);
    setTransition(undefined);

    if (sheet) {
      const next = Math.max(
        POPUP_MIN_HEIGHT_PX,
        Math.min(sheetHeightRef.current, vh - POPUP_MARGIN_PX),
      );
      sheetHeightRef.current = next;
      setSheetHeight(next);
    } else {
      const pos = computeAndClampPosition(nextSize, { left: 0, top: 0 }, vw, vh);
      setPosition(pos);
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
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    sessionRef.current = {
      type: 'sheet',
      startY: e.clientY,
      startHeight: sheetHeightRef.current,
      fromHandle: false,
      target,
      pointerId: e.pointerId,
    };
    startWillChange();
    try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }, [startWillChange]);

  const style: CSSProperties = isSheet
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        top: 'auto',
        bottom: 0,
        width: '100%',
        height: Math.max(
          POPUP_MIN_HEIGHT_PX,
          Math.min(sheetHeight, getClientHeight() - POPUP_MARGIN_PX),
        ),
        maxHeight: getClientHeight() - POPUP_MARGIN_PX,
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
