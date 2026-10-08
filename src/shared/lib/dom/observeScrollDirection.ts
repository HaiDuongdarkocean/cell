export type ScrollDirection = 'up' | 'down';

export interface ScrollDirectionObserverOptions {
  readonly threshold?: number;
  readonly cooldownMs?: number;
  readonly swipeThreshold?: number;
  readonly canChange?: (direction: ScrollDirection, el: HTMLElement) => boolean;
  readonly onScroll?: (top: number, delta: number, el: HTMLElement) => boolean | void;
  readonly onDirection: (direction: ScrollDirection, top: number, el: HTMLElement) => void;
}

export function observeScrollDirection(
  targets: HTMLElement | readonly HTMLElement[],
  options: ScrollDirectionObserverOptions,
): () => void {
  const elements = Array.isArray(targets) ? targets : [targets];
  const threshold = options.threshold ?? 1;
  const cooldownMs = options.cooldownMs ?? 0;
  const swipeThreshold = options.swipeThreshold;
  const lastTops = new WeakMap<HTMLElement, number>();
  elements.forEach((el) => lastTops.set(el, el.scrollTop));
  let cooldownUntil = 0;
  let touchStartY: number | null = null;

  const dispatch = (direction: ScrollDirection, top: number, el: HTMLElement): void => {
    if (options.canChange && !options.canChange(direction, el)) return;
    options.onDirection(direction, top, el);
    cooldownUntil = performance.now() + cooldownMs;
  };

  const handleScroll = (e: Event): void => {
    const el = e.currentTarget as HTMLElement;
    const top = el.scrollTop;
    const delta = top - (lastTops.get(el) ?? top);
    lastTops.set(el, top);
    if (options.onScroll?.(top, delta, el) === true) return;
    if (top <= 0) {
      cooldownUntil = 0;
      options.onDirection('up', top, el);
      return;
    }
    if (performance.now() < cooldownUntil) return;
    if (Math.abs(delta) < threshold) return;
    dispatch(delta > 0 ? 'down' : 'up', top, el);
  };

  const handleTouchStart = (e: TouchEvent): void => {
    touchStartY = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: TouchEvent): void => {
    const el = e.currentTarget as HTMLElement;
    if (touchStartY === null || performance.now() < cooldownUntil) return;
    const deltaY = (e.changedTouches[0]?.clientY ?? touchStartY) - touchStartY;
    touchStartY = null;
    if (Math.abs(deltaY) < (swipeThreshold ?? 20)) return;
    dispatch(deltaY > 0 ? 'down' : 'up', el.scrollTop, el);
  };

  elements.forEach((el) => {
    el.addEventListener('scroll', handleScroll, { passive: true });
    if (swipeThreshold !== undefined) {
      el.addEventListener('touchstart', handleTouchStart, { passive: true });
      el.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
  });

  return () => {
    elements.forEach((el) => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    });
  };
}
