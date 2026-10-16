import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';

export interface UsePaneResizeOptions {
  /** Split container — its width is the 100% the pct resolves against. */
  readonly containerRef: RefObject<HTMLElement | null>;
  /** Storage key persisting pct across sessions. Omit for session-only. */
  readonly storageKey?: string;
  readonly defaultPct?: number;
  readonly minPct?: number;
  readonly maxPct?: number;
  /** Keyboard step in pct points. Default 5. */
  readonly stepPct?: number;
}

export interface PaneResizeHandleProps {
  readonly onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  readonly onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  readonly 'aria-valuenow': number;
  readonly 'aria-valuemin': number;
  readonly 'aria-valuemax': number;
}

/**
 * usePaneResize — drag/keyboard resize for a horizontal two-pane split.
 * `pct` is the width % of the pane AFTER the handle (dragging left grows it).
 * Spread `handleProps` onto a `<ResizeHandle>` (or any separator element)
 * placed between the two panes.
 */
export function usePaneResize({
  containerRef,
  storageKey,
  defaultPct = 50,
  minPct = 20,
  maxPct = 80,
  stepPct = 5,
}: UsePaneResizeOptions): { pct: number; handleProps: PaneResizeHandleProps } {
  const [pct, setPct] = useState(defaultPct);
  const dragRef = useRef<{ startX: number; startPct: number; width: number } | null>(null);

  const clamp = useCallback(
    (next: number): number => Math.min(Math.max(next, minPct), maxPct),
    [minPct, maxPct],
  );

  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    getStorage<Record<string, number>>(storageKey)
      .then((data) => {
        const stored = data[storageKey];
        if (cancelled || typeof stored !== 'number' || !Number.isFinite(stored)) return;
        setPct(clamp(stored));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [storageKey, clamp]);

  const persist = useCallback(
    (next: number): void => {
      if (storageKey) setStorage({ [storageKey]: next }).catch(() => undefined);
    },
    [storageKey],
  );

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>): void => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      dragRef.current = {
        startX: e.clientX,
        startPct: pct,
        width: container.getBoundingClientRect().width,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [containerRef, pct],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>): void => {
      const d = dragRef.current;
      if (!d || d.width <= 0) return;
      setPct(clamp(d.startPct - ((e.clientX - d.startX) / d.width) * 100));
    },
    [clamp],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent<HTMLElement>): void => {
      if (!dragRef.current) return;
      dragRef.current = null;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      setPct((next) => {
        persist(next);
        return next;
      });
    },
    [persist],
  );

  // WAI-ARIA window-splitter: ArrowLeft/Right, Home/End.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>): void => {
      let next: number | null = null;
      if (e.key === 'ArrowLeft') next = pct + stepPct;
      else if (e.key === 'ArrowRight') next = pct - stepPct;
      else if (e.key === 'Home') next = minPct;
      else if (e.key === 'End') next = maxPct;
      if (next === null) return;
      e.preventDefault();
      const clamped = clamp(next);
      setPct(clamped);
      persist(clamped);
    },
    [pct, stepPct, minPct, maxPct, clamp, persist],
  );

  return {
    pct,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onKeyDown,
      'aria-valuenow': Math.round(pct),
      'aria-valuemin': minPct,
      'aria-valuemax': maxPct,
    },
  };
}
