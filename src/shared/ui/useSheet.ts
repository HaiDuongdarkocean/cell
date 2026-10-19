import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent, RefObject } from 'react';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';

const SHEET_MIN_HEIGHT_PX = 200;
const SHEET_DEFAULT_HEIGHT_PX = 300;
const SHEET_MARGIN_PX = 8;
export const SHEET_CLICK_THRESHOLD_PX = 4;
export const SHEET_DISMISS_THRESHOLD_PX = 100;
export const SHEET_DISMISS_RATIO = 0.2;
const SHEET_FLING_PX_PER_MS = 0.5;
const SHEET_FLING_MIN_PX = 50;
const SHEET_DISMISS_ANIM_MS = 300;
const CLICK_SWALLOW_WINDOW_MS = 500;

let releaseClickSwallower: (() => void) | null = null;

function armClickSwallower(): void {
  releaseClickSwallower?.();
  const release = (): void => {
    clearTimeout(timer);
    document.removeEventListener('click', onClick, true);
    if (releaseClickSwallower === release) releaseClickSwallower = null;
  };
  const onClick = (e: MouseEvent): void => {
    if (e.detail === 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    release();
  };
  const timer = setTimeout(release, CLICK_SWALLOW_WINDOW_MS);
  releaseClickSwallower = release;
  document.addEventListener('click', onClick, true);
}

function safeHeight(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function getClientHeight(): number {
  return document.documentElement?.clientHeight ?? window.innerHeight;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('input, textarea, select, [contenteditable]');
}

function scrollersAtTop(path: readonly EventTarget[], stopAt: HTMLElement, content: HTMLElement | null): readonly HTMLElement[] | null {
  const scrollable = (el: HTMLElement): boolean => {
    if (el.scrollHeight <= el.clientHeight) return false;
    const overflowY = getComputedStyle(el).overflowY;
    return overflowY === 'auto' || overflowY === 'scroll';
  };
  const found: HTMLElement[] = [];
  for (const node of path) {
    if (!(node instanceof HTMLElement)) continue;
    if (scrollable(node)) {
      if (node.scrollTop > 0) return null;
      found.push(node);
    }
    if (node === stopAt) break;
  }
  if (content && !found.includes(content)) {
    if (scrollable(content) && content.scrollTop > 0) return null;
    if (scrollable(content)) found.push(content);
  }
  return found;
}

interface SheetSession {
  readonly startX: number;
  readonly startY: number;
  readonly startHeight: number;
  readonly fromHandle: boolean;
  readonly target: HTMLElement;
  readonly pointerId: number;
  readonly scrollers?: readonly HTMLElement[];
}

export interface UseSheetOptions {
  readonly initialHeight?: number;
  readonly maxHeight?: number;
  readonly onClose?: () => void;
  readonly onHeightChange?: (height: number) => void;
  readonly persistKey?: string;
}

export interface UseSheetResult {
  readonly sheetRef: RefObject<HTMLDivElement | null>;
  readonly contentRef: RefObject<HTMLDivElement | null>;
  readonly sheetHeight: number;
  readonly style: CSSProperties;
  readonly dismissArmed: boolean;
  readonly onPointerDownHandle: (e: PointerEvent<HTMLDivElement>) => void;
  readonly onKeyDownHandle: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  readonly onPointerDownContent: (e: PointerEvent<HTMLDivElement>) => void;
}

export function useSheet(options: UseSheetOptions = {}): UseSheetResult {
  const {
    initialHeight = SHEET_DEFAULT_HEIGHT_PX,
    maxHeight,
    onClose,
    onHeightChange,
    persistKey,
  } = options;

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onHeightChangeRef = useRef(onHeightChange);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onHeightChangeRef.current = onHeightChange; }, [onHeightChange]);

  const getAvailableHeight = useCallback((): number => {
    if (typeof maxHeight === 'number' && Number.isFinite(maxHeight) && maxHeight > 0) return maxHeight;
    return Math.max(0, getClientHeight() - SHEET_MARGIN_PX);
  }, [maxHeight]);

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
  const [dismissArmed, setDismissArmed] = useState(false);

  const sheetHeightRef = useRef(sheetHeight);
  const sessionRef = useRef<SheetSession | null>(null);
  const lastPointerRef = useRef<{ readonly clientX: number; readonly clientY: number; readonly t: number } | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerRafRef = useRef<number | null>(null);
  const snapBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { sheetHeightRef.current = sheetHeight; }, [sheetHeight]);

  useEffect(() => {
    if (!persistKey) return;
    let cancelled = false;
    getStorage<Record<string, number>>(persistKey)
      .then((data) => {
        const stored = data[persistKey];
        if (cancelled || sessionRef.current) return;
        if (typeof stored !== 'number' || !Number.isFinite(stored)) return;
        const vh = Math.max(20, Math.min(95, stored));
        const avail = getAvailableHeight();
        const min = getEffectiveMin();
        const next = Math.max(min, Math.min((vh / 100) * getClientHeight(), avail));
        sheetHeightRef.current = next;
        setSheetHeight(next);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [persistKey, getAvailableHeight, getEffectiveMin]);

  const emitHeightChange = useCallback((h: number) => {
    onHeightChangeRef.current?.(h);
    if (!persistKey) return;
    const vh = Math.max(20, Math.min(95, Math.round((h / getClientHeight()) * 100)));
    void setStorage({ [persistKey]: vh }).catch(() => undefined);
  }, [persistKey]);

  useEffect(() => {
    if (sessionRef.current) return;
    if (typeof initialHeight !== 'number' || !Number.isFinite(initialHeight) || initialHeight <= 0) return;
    const avail = getAvailableHeight();
    const min = getEffectiveMin();
    const next = Math.max(min, Math.min(initialHeight, avail));
    sheetHeightRef.current = next;
    setSheetHeight(next);
  }, [initialHeight, getAvailableHeight, getEffectiveMin]);

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

  useEffect(() => {
    return () => {
      if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const endSession = useCallback((clientX: number, clientY: number) => {
    const session = sessionRef.current;
    if (!session) return;
    try { session.target.releasePointerCapture(session.pointerId); } catch {}
    sessionRef.current = null;
    setWillChange(undefined);
    setTransition(undefined);
    setTransform(undefined);
    setDismissArmed(false);
    const last = lastPointerRef.current;
    lastPointerRef.current = null;

    const dy = clientY - session.startY;
    const vh = getClientHeight();
    const closeFromPointer = (): void => {
      const onClose = onCloseRef.current;
      if (!onClose) return;
      armClickSwallower();
      onClose();
    };
    const animateClose = (): void => {
      const onClose = onCloseRef.current;
      if (!onClose) return;
      armClickSwallower();
      if (typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        onClose();
        return;
      }
      setTransition('transform var(--duration-300) var(--ease-standard)');
      setTransform('translateY(105%)');
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        onClose();
      }, SHEET_DISMISS_ANIM_MS);
    };

    if (session.fromHandle) {
      const dx = clientX - session.startX;
      if (Math.hypot(dx, dy) <= SHEET_CLICK_THRESHOLD_PX) {
        closeFromPointer();
        return;
      }
      const rawHeight = session.startHeight - dy;
      if (rawHeight < vh * SHEET_DISMISS_RATIO) {
        animateClose();
        return;
      }
      emitHeightChange(sheetHeightRef.current);
      return;
    }

    const scrolledAway = session.scrollers?.some((el) => el.scrollTop > 0) ?? false;
    const fling = last !== null
      && dy > SHEET_FLING_MIN_PX
      && (clientY - last.clientY) / Math.max(1, performance.now() - last.t) > SHEET_FLING_PX_PER_MS;
    if (!scrolledAway && (dy > SHEET_DISMISS_THRESHOLD_PX || fling)) {
      animateClose();
      return;
    }
    if (dy > SHEET_CLICK_THRESHOLD_PX) armClickSwallower();
    setTransition('transform var(--duration-normal) var(--ease-spring)');
    setTransform('translateY(0)');
    if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    snapBackTimerRef.current = setTimeout(() => {
      snapBackTimerRef.current = null;
      setTransition(undefined);
      setTransform(undefined);
    }, 200);
  }, [emitHeightChange]);

  const applyPointerUpdate = useCallback((clientX: number, clientY: number) => {
    const session = sessionRef.current;
    if (!session) return;
    const dy = clientY - session.startY;
    if (session.fromHandle) {
      const avail = getAvailableHeight();
      const min = getEffectiveMin();
      const next = Math.max(min, Math.min(session.startHeight - dy, avail));
      sheetHeightRef.current = next;
      setSheetHeight(next);
    } else {
      const dragged = session.scrollers?.some((el) => el.scrollTop > 0);
      const sideways = Math.abs(clientX - session.startX) > Math.abs(dy);
      const pull = dragged || sideways ? 0 : Math.max(0, dy);
      setTransform(`translateY(${pull}px)`);
      setTransition('none');
      setDismissArmed(pull > SHEET_DISMISS_THRESHOLD_PX);
    }
  }, [getAvailableHeight, getEffectiveMin]);

  const onPointerMove = useCallback((e: globalThis.PointerEvent) => {
    if (sessionRef.current?.pointerId !== e.pointerId) return;
    lastPointerRef.current = { clientX: e.clientX, clientY: e.clientY, t: performance.now() };
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
    if (sessionRef.current?.pointerId !== e.pointerId) return;
    if (pointerRafRef.current) {
      cancelAnimationFrame(pointerRafRef.current);
      pointerRafRef.current = null;
      const p = lastPointerRef.current;
      if (p) applyPointerUpdate(p.clientX, p.clientY);
    }
    endSession(e.clientX, e.clientY);
  }, [applyPointerUpdate, endSession]);

  const onPointerCancel = useCallback((e: globalThis.PointerEvent) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    sessionRef.current = null;
    lastPointerRef.current = null;
    setWillChange(undefined);
    setDismissArmed(false);
    if (!session.fromHandle) {
      setTransition('transform var(--duration-normal) var(--ease-spring)');
      setTransform('translateY(0)');
      if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
      snapBackTimerRef.current = setTimeout(() => {
        snapBackTimerRef.current = null;
        setTransition(undefined);
        setTransform(undefined);
      }, 200);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    return () => {
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
    };
  }, [onPointerMove, onPointerUp, onPointerCancel]);

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
    try { target.setPointerCapture(e.pointerId); } catch {}
  }, []);

  const SHEET_KEY_STEP_PX = 32;
  const onKeyDownHandle = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const avail = getAvailableHeight();
    const min = getEffectiveMin();
    let next: number | null = null;
    if (e.key === 'ArrowUp') next = sheetHeightRef.current + SHEET_KEY_STEP_PX;
    else if (e.key === 'ArrowDown') next = sheetHeightRef.current - SHEET_KEY_STEP_PX;
    else if (e.key === 'Home') next = avail;
    else if (e.key === 'End') next = min;
    if (next === null) return;
    e.preventDefault();
    const clamped = Math.max(min, Math.min(next, avail));
    sheetHeightRef.current = clamped;
    setSheetHeight(clamped);
    emitHeightChange(clamped);
  }, [getAvailableHeight, getEffectiveMin, emitHeightChange]);

  const onPointerDownContent = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (isEditableTarget(e.target)) return;
    const scrollers = scrollersAtTop(e.nativeEvent.composedPath(), e.currentTarget, contentRef.current);
    if (!scrollers) return;
    e.stopPropagation();
    sessionRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startHeight: sheetHeightRef.current,
      fromHandle: false,
      target: e.currentTarget,
      pointerId: e.pointerId,
      scrollers,
    };
    setWillChange('transform');
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const session = sessionRef.current;
    if (!session || session.fromHandle) return;
    const t = e.touches[0];
    if (!t) return;
    const dy = t.clientY - session.startY;
    const scrolledAway = session.scrollers?.some((el) => el.scrollTop > 0) ?? false;
    if (dy > 2 && !scrolledAway) e.preventDefault();
  }, []);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [onTouchMove]);

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
    contentRef,
    sheetHeight,
    style,
    dismissArmed,
    onPointerDownHandle,
    onKeyDownHandle,
    onPointerDownContent,
  };
}
