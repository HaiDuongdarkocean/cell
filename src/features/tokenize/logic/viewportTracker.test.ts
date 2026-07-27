import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { ViewportTracker } from './viewportTracker';

let mockObservers: MockIntersectionObserver[] = [];

class MockIntersectionObserver {
  private readonly callback: IntersectionObserverCallback;
  private readonly targets = new Set<Element>();

  constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    this.callback = callback;
    mockObservers.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
  }

  /** Simulate an intersection change for all observed targets. */
  emit(entries: { target: Element; isIntersecting: boolean }[]): void {
    this.callback(
      entries.map((e) => ({
        target: e.target,
        isIntersecting: e.isIntersecting,
        intersectionRatio: e.isIntersecting ? 1 : 0,
        boundingClientRect: new DOMRect(),
        intersectionRect: new DOMRect(),
        rootBounds: new DOMRect(),
        time: 0,
      })) as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

describe('ViewportTracker', () => {
  let originalIO: typeof IntersectionObserver;

  beforeEach(() => {
    mockObservers = [];
    originalIO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIO;
  });

  it('calls onEnter when an element becomes visible', () => {
    const tracker = new ViewportTracker({ rootMargin: '200% 0' });
    const el = document.createElement('p');
    const onEnter = jest.fn();
    const onExit = jest.fn();
    tracker.observe(el, { onEnter, onExit });
    expect(mockObservers).toHaveLength(1);
    mockObservers[0]!.emit([{ target: el, isIntersecting: true }]);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('calls onExit when an element leaves', () => {
    const tracker = new ViewportTracker();
    const el = document.createElement('p');
    const onEnter = jest.fn();
    const onExit = jest.fn();
    tracker.observe(el, { onEnter, onExit });
    const observer = mockObservers[0]!;
    observer.emit([{ target: el, isIntersecting: true }]);
    observer.emit([{ target: el, isIntersecting: false }]);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('fires all handler sets for the same element', () => {
    const tracker = new ViewportTracker();
    const el = document.createElement('p');
    const onEnterA = jest.fn();
    const onEnterB = jest.fn();
    tracker.observe(el, { onEnter: onEnterA });
    tracker.observe(el, { onEnter: onEnterB });
    // IntersectionObserver.observe should only be called once for the element
    expect(mockObservers).toHaveLength(1);
    mockObservers[0]!.emit([{ target: el, isIntersecting: true }]);
    expect(onEnterA).toHaveBeenCalledTimes(1);
    expect(onEnterB).toHaveBeenCalledTimes(1);
  });
});
