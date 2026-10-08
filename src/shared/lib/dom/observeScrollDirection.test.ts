import { observeScrollDirection } from './observeScrollDirection';

function makeScroller(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperties(el, {
    scrollTop: { value: 0, writable: true, configurable: true },
    scrollHeight: { value: 1000, writable: true, configurable: true },
    clientHeight: { value: 200, writable: true, configurable: true },
  });
  return el;
}

function fireScroll(el: HTMLElement, top: number): void {
  Object.defineProperty(el, 'scrollTop', { value: top, configurable: true });
  el.dispatchEvent(new Event('scroll'));
}

function fireTouch(el: HTMLElement, startY: number, endY: number): void {
  el.dispatchEvent(new TouchEvent('touchstart', { touches: [{ clientY: startY } as Touch] }));
  el.dispatchEvent(new TouchEvent('touchend', { changedTouches: [{ clientY: endY } as Touch] }));
}

describe('observeScrollDirection', () => {
  it('dispatches down then up based on scroll delta', () => {
    const el = makeScroller();
    const dirs: string[] = [];
    const stop = observeScrollDirection(el, { threshold: 8, onDirection: (d) => dirs.push(d) });

    fireScroll(el, 40);
    fireScroll(el, 10);
    expect(dirs).toEqual(['down', 'up']);
    stop();
  });

  it('ignores deltas below threshold', () => {
    const el = makeScroller();
    const dirs: string[] = [];
    const stop = observeScrollDirection(el, { threshold: 8, onDirection: (d) => dirs.push(d) });

    fireScroll(el, 4);
    fireScroll(el, 40);
    expect(dirs).toEqual(['down']);
    stop();
  });

  it('always dispatches up at scroll top, bypassing cooldown', () => {
    const el = makeScroller();
    const dirs: string[] = [];
    const stop = observeScrollDirection(el, {
      threshold: 8,
      cooldownMs: 30000,
      onDirection: (d) => dirs.push(d),
    });

    fireScroll(el, 40);
    fireScroll(el, 80);
    fireScroll(el, 0);
    expect(dirs).toEqual(['down', 'up']);
    stop();
  });

  it('suppresses direction changes during cooldown', () => {
    const el = makeScroller();
    const dirs: string[] = [];
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValue(1000);
    const stop = observeScrollDirection(el, {
      threshold: 8,
      cooldownMs: 300,
      onDirection: (d) => dirs.push(d),
    });

    fireScroll(el, 40);
    nowSpy.mockReturnValue(1100);
    fireScroll(el, 10);
    nowSpy.mockReturnValue(1400);
    fireScroll(el, 50);
    expect(dirs).toEqual(['down', 'down']);
    stop();
    nowSpy.mockRestore();
  });

  it('lets canChange gate each direction', () => {
    const el = makeScroller();
    const dirs: string[] = [];
    const stop = observeScrollDirection(el, {
      threshold: 8,
      onDirection: (d) => dirs.push(d),
      canChange: (d) => d === 'up',
    });

    fireScroll(el, 40);
    fireScroll(el, 10);
    expect(dirs).toEqual(['up']);
    stop();
  });

  it('lets onScroll consume an event before direction dispatch', () => {
    const el = makeScroller();
    const dirs: string[] = [];
    let suppress = true;
    const stop = observeScrollDirection(el, {
      threshold: 8,
      onScroll: () => suppress,
      onDirection: (d) => dirs.push(d),
    });

    fireScroll(el, 40);
    suppress = false;
    fireScroll(el, 80);
    expect(dirs).toEqual(['down']);
    stop();
  });

  it('tracks each scroller independently', () => {
    const a = makeScroller();
    const b = makeScroller();
    const dirs: string[] = [];
    const stop = observeScrollDirection([a, b], { threshold: 8, onDirection: (d) => dirs.push(d) });

    fireScroll(a, 40);
    fireScroll(b, 60);
    fireScroll(b, 20);
    expect(dirs).toEqual(['down', 'down', 'up']);
    stop();
  });

  it('dispatches on touch swipe when swipeThreshold is set', () => {
    const el = makeScroller();
    const dirs: string[] = [];
    const stop = observeScrollDirection(el, {
      threshold: 8,
      swipeThreshold: 20,
      onDirection: (d) => dirs.push(d),
    });

    fireTouch(el, 100, 150);
    fireTouch(el, 100, 60);
    expect(dirs).toEqual(['down', 'up']);
    stop();
  });

  it('does not attach touch listeners when swipeThreshold is unset', () => {
    const el = makeScroller();
    const spy = jest.spyOn(el, 'addEventListener');
    const stop = observeScrollDirection(el, { onDirection: () => undefined });
    expect(spy.mock.calls.map(([type]) => type)).toEqual(['scroll']);
    stop();
    spy.mockRestore();
  });
});
