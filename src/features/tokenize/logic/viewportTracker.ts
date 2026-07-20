export interface ViewportTrackerHandlers {
  /** Called when the element enters the observed range. */
  readonly onEnter?: () => void;
  /** Called when the element leaves the observed range. */
  readonly onExit?: () => void;
}

export interface ViewportTrackerOptions {
  /** CSS rootMargin passed to IntersectionObserver. */
  readonly rootMargin?: string;
  /** Threshold array passed to IntersectionObserver. */
  readonly threshold?: number | number[];
  /** Element used as the observer root. */
  readonly root?: Element | null;
}

/** Thin wrapper around IntersectionObserver for viewport/buffer tracking. */
export class ViewportTracker {
  private readonly observer: IntersectionObserver | null;
  private readonly handlers = new WeakMap<Element, Set<ViewportTrackerHandlers>>();
  private readonly state = new WeakMap<Element, boolean>();

  constructor({ rootMargin = '0px', threshold = 0, root = null }: ViewportTrackerOptions = {}) {
    if (typeof IntersectionObserver === 'undefined') {
      this.observer = null;
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => this.handleEntries(entries),
      { root, rootMargin, threshold },
    );
  }

  /** Observe an element and attach handlers. Multiple handler sets per element are supported. */
  observe(element: Element, handlers: ViewportTrackerHandlers = {}): void {
    let set = this.handlers.get(element);
    if (!set) {
      set = new Set();
      this.handlers.set(element, set);
      this.state.set(element, false);
      this.observer?.observe(element);
    }
    set.add(handlers);
  }

  /** Stop observing a specific handler set for an element. */
  unobserve(element: Element, handlers?: ViewportTrackerHandlers): void {
    const set = this.handlers.get(element);
    if (!set) return;
    if (handlers) {
      set.delete(handlers);
      if (set.size > 0) return;
    }
    this.observer?.unobserve(element);
    this.handlers.delete(element);
    this.state.delete(element);
  }

  /** Disconnect the underlying observer. */
  destroy(): void {
    this.observer?.disconnect();
  }

  private handleEntries(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const target = entry.target as Element;
      const set = this.handlers.get(target);
      if (!set) continue;
      const wasIntersecting = this.state.get(target) ?? false;
      const isIntersecting = entry.isIntersecting;
      if (isIntersecting && !wasIntersecting) {
        for (const h of set) h.onEnter?.();
      } else if (!isIntersecting && wasIntersecting) {
        for (const h of set) h.onExit?.();
      }
      this.state.set(target, isIntersecting);
    }
  }
}
