import { useCallback, useEffect, useRef, useState } from 'react';

export interface SectionDrag {
  readonly draggedId: number | string;
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly fromTop: number;
  readonly offsetY: number;
  readonly slotTop: number;
  readonly cardHeight: number;
  readonly gap: number;
  readonly settling: boolean;
}

interface DragSession {
  list: HTMLElement;
  draggedEl: HTMLElement;
  draggedId: number | string;
  slotPrefix: string;
  scrollParent: HTMLElement | null;
  grabOffsetY: number;
  fromTop: number;
  cardHeight: number;
  gap: number;
  fromIndex: number;
  toIndex: number;
  lastClientY: number;
  edgeDir: -1 | 0 | 1;
  rafId: number;
  reduceMotion: boolean;
}

const EDGE_ZONE = 56;
const EDGE_STEP = 10;
const SETTLE_MS = 200;

const DEFAULT_SLOT_PREFIX = 'slot-';

function slotElements(list: HTMLElement, slotPrefix: string): HTMLElement[] {
  return Array.from(list.querySelectorAll<HTMLElement>(`[data-cell-id^="${slotPrefix}"]`));
}

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export interface UseSectionDragOptions {
  /** `data-cell-id` prefix identifying draggable slot wrappers. Default 'slot-'. */
  readonly slotPrefix?: string;
}

export function useSectionDrag(
  onDrop: (draggedId: number | string, toIndex: number) => void,
  options?: UseSectionDragOptions,
): {
  readonly listRef: React.RefObject<HTMLDivElement | null>;
  readonly drag: SectionDrag | null;
  readonly beginDrag: (index: number, draggedId: number | string, e: React.PointerEvent<HTMLElement>) => void;
} {
  const slotPrefix = options?.slotPrefix ?? DEFAULT_SLOT_PREFIX;
  const listRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<SectionDrag | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback((commit: boolean) => {
    const s = sessionRef.current;
    sessionRef.current = null;
    if (s && s.rafId) cancelAnimationFrame(s.rafId);
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setDrag(null);
    if (s && commit && s.toIndex !== s.fromIndex) onDrop(s.draggedId, s.toIndex);
  }, [onDrop]);

  const updateDrag = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    const pointerListY = s.lastClientY - s.list.getBoundingClientRect().top;
    const rest = slotElements(s.list, s.slotPrefix).filter((el) => el !== s.draggedEl);
    let toIndex = 0;
    rest.forEach((el, i) => {
      if (pointerListY > el.offsetTop + el.offsetHeight / 2) toIndex = i + 1;
    });
    const last = rest[rest.length - 1];
    const slotTop = toIndex < rest.length
      ? rest[toIndex]!.offsetTop
      : last
        ? last.offsetTop + last.offsetHeight + s.gap
        : 0;
    const offsetY = pointerListY - s.grabOffsetY - s.fromTop;
    s.toIndex = toIndex;
    if (s.scrollParent) {
      const bounds = s.scrollParent.getBoundingClientRect();
      s.edgeDir = s.lastClientY < bounds.top + EDGE_ZONE
        ? -1
        : s.lastClientY > bounds.bottom - EDGE_ZONE
          ? 1
          : 0;
    }
    setDrag((prev) => prev && { ...prev, offsetY, toIndex, slotTop });
  }, []);

  const endDrag = useCallback((commit: boolean) => {
    const s = sessionRef.current;
    if (!s) return;
    if (s.reduceMotion) {
      finish(commit);
      return;
    }
    setDrag((prev) => prev && {
      ...prev,
      settling: true,
      offsetY: commit ? prev.slotTop - prev.fromTop : 0,
    });
    settleTimerRef.current = setTimeout(() => finish(commit), SETTLE_MS);
  }, [finish]);

  const beginDrag = useCallback((index: number, draggedId: number | string, e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || e.isPrimary === false) return;
    if (sessionRef.current) return;
    const list = listRef.current;
    if (!list) return;
    const el = slotElements(list, slotPrefix)[index];
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = el.getBoundingClientRect();
    const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
    sessionRef.current = {
      list,
      draggedEl: el,
      draggedId,
      slotPrefix,
      scrollParent: findScrollParent(list),
      grabOffsetY: e.clientY - rect.top,
      fromTop: el.offsetTop,
      cardHeight: rect.height,
      gap,
      fromIndex: index,
      toIndex: index,
      lastClientY: e.clientY,
      edgeDir: 0,
      rafId: 0,
      reduceMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    };
    setDrag({
      draggedId,
      fromIndex: index,
      toIndex: index,
      fromTop: el.offsetTop,
      offsetY: 0,
      slotTop: el.offsetTop,
      cardHeight: rect.height,
      gap,
      settling: false,
    });
  }, [slotPrefix]);

  useEffect(() => {
    const s = sessionRef.current;
    if (!drag || drag.settling || !s) return;

    const onMove = (e: PointerEvent): void => {
      s.lastClientY = e.clientY;
      updateDrag();
    };
    const onUp = (): void => endDrag(true);
    const onCancel = (): void => endDrag(false);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') endDrag(false);
    };
    const onScroll = (): void => updateDrag();
    const tick = (): void => {
      const cur = sessionRef.current;
      if (!cur) return;
      if (cur.edgeDir !== 0 && cur.scrollParent) {
        cur.scrollParent.scrollTop += cur.edgeDir * EDGE_STEP;
        updateDrag();
      }
      cur.rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    s.scrollParent?.addEventListener('scroll', onScroll);
    s.rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      s.scrollParent?.removeEventListener('scroll', onScroll);
      if (s.rafId) cancelAnimationFrame(s.rafId);
    };
  }, [drag, updateDrag, endDrag]);

  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    const s = sessionRef.current;
    if (s && s.rafId) cancelAnimationFrame(s.rafId);
  }, []);

  return { listRef, drag, beginDrag };
}
