export interface CollapseOnScrollOptions {
  /** Cumulative px scrolled down before collapsing. Default 16. */
  readonly hideDelta?: number;
  /** Cumulative px scrolled up before expanding — the "not too eager" buffer.
   *  Default 48. */
  readonly showDelta?: number;
  /** Minimum scrollTop before collapsing is allowed. Default 48. */
  readonly hideOffset?: number;
  /** scrollTop at or below this always expands. Default 8. */
  readonly topOffset?: number;
  readonly onCollapsed: (collapsed: boolean) => void;
}

export function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node && !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) {
    node = node.parentElement;
  }
  return node;
}

/**
 * Collapse-on-scroll with asymmetric hysteresis: quick to hide on the way
 * down, deliberate on the way back up. Listens on `target` in capture phase
 * so nested scroll containers (a scrolling child of `target`) also drive it.
 * Direction flips reset the accumulator — a flick can't accumulate into a
 * state change. Per-scroller state lives in WeakMaps so several nested
 * scrollers each track their own position.
 */
export function collapseOnScroll(
  target: HTMLElement,
  options: CollapseOnScrollOptions,
): () => void {
  const hideDelta = options.hideDelta ?? 16;
  const showDelta = options.showDelta ?? 48;
  const hideOffset = options.hideOffset ?? 48;
  const topOffset = options.topOffset ?? 8;
  const lastTop = new WeakMap<Element, number>();
  const acc = new WeakMap<Element, number>();
  let dir = 0;

  const onScroll = (e: Event): void => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const top = el.scrollTop;
    const prev = lastTop.get(el) ?? top;
    const delta = top - prev;
    lastTop.set(el, top);
    if (top <= topOffset) {
      dir = 0;
      acc.set(el, 0);
      options.onCollapsed(false);
      return;
    }
    const sign = Math.sign(delta);
    if (sign !== 0 && sign !== dir) {
      dir = sign;
      acc.set(el, 0);
    }
    const cum = (acc.get(el) ?? 0) + Math.abs(delta);
    acc.set(el, cum);
    if (dir === 1 && cum > hideDelta && top > hideOffset) options.onCollapsed(true);
    if (dir === -1 && cum > showDelta) options.onCollapsed(false);
  };

  target.addEventListener('scroll', onScroll, { passive: true, capture: true });
  return () => {
    target.removeEventListener('scroll', onScroll, true);
    options.onCollapsed(false);
  };
}
