import { collapseOnScroll, findScrollableAncestor } from './collapseOnScroll';

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

describe('collapseOnScroll', () => {
  it('collapses after cumulative scroll down past hideDelta', () => {
    const el = makeScroller();
    const states: boolean[] = [];
    const stop = collapseOnScroll(el, { onCollapsed: (c) => states.push(c) });

    fireScroll(el, 60);
    fireScroll(el, 70);
    expect(states).toEqual([]);
    fireScroll(el, 90);
    expect(states).toEqual([true]);
    stop();
  });

  it('does not collapse while below hideOffset', () => {
    const el = makeScroller();
    const states: boolean[] = [];
    const stop = collapseOnScroll(el, { onCollapsed: (c) => states.push(c) });

    fireScroll(el, 10);
    fireScroll(el, 30);
    expect(states).toEqual([]);
    stop();
  });

  it('ignores small upward scrolls below the show buffer', () => {
    const el = makeScroller();
    const states: boolean[] = [];
    const stop = collapseOnScroll(el, { onCollapsed: (c) => states.push(c) });

    fireScroll(el, 60);
    fireScroll(el, 90);
    fireScroll(el, 70);
    fireScroll(el, 60);
    expect(states).toEqual([true]);
    stop();
  });

  it('expands after cumulative scroll up past showDelta', () => {
    const el = makeScroller();
    const states: boolean[] = [];
    const stop = collapseOnScroll(el, { onCollapsed: (c) => states.push(c) });

    fireScroll(el, 60);
    fireScroll(el, 120);
    fireScroll(el, 90);
    fireScroll(el, 60);
    fireScroll(el, 20);
    expect(states).toEqual([true, false, false]);
    stop();
  });

  it('always expands at the top regardless of buffer', () => {
    const el = makeScroller();
    const states: boolean[] = [];
    const stop = collapseOnScroll(el, { onCollapsed: (c) => states.push(c) });

    fireScroll(el, 60);
    fireScroll(el, 200);
    fireScroll(el, 4);
    expect(states).toEqual([true, false]);
    stop();
  });

  it('resets the accumulator on direction flip', () => {
    const el = makeScroller();
    const states: boolean[] = [];
    const stop = collapseOnScroll(el, { onCollapsed: (c) => states.push(c) });

    fireScroll(el, 60);
    fireScroll(el, 90);
    fireScroll(el, 50);
    fireScroll(el, 60);
    fireScroll(el, 40);
    expect(states).toEqual([true]);
    stop();
  });

  it('tracks a nested scroller via capture', () => {
    const outer = makeScroller();
    const inner = makeScroller();
    outer.appendChild(inner);
    const states: boolean[] = [];
    const stop = collapseOnScroll(outer, { onCollapsed: (c) => states.push(c) });

    fireScroll(inner, 60);
    fireScroll(inner, 90);
    fireScroll(inner, 0);
    expect(states).toEqual([true, false]);
    stop();
  });

  it('cleanup removes the listener and expands', () => {
    const el = makeScroller();
    const states: boolean[] = [];
    const stop = collapseOnScroll(el, { onCollapsed: (c) => states.push(c) });

    fireScroll(el, 60);
    fireScroll(el, 90);
    stop();
    fireScroll(el, 300);
    expect(states).toEqual([true, false]);
  });
});

describe('findScrollableAncestor', () => {
  it('walks up to the first overflow-y auto/scroll ancestor', () => {
    const root = document.createElement('div');
    const mid = document.createElement('div');
    const leaf = document.createElement('div');
    root.appendChild(mid);
    mid.appendChild(leaf);
    const fakeGet = jest
      .spyOn(window, 'getComputedStyle')
      .mockImplementation((n) => ({ overflowY: n === root ? 'auto' : 'visible' }) as CSSStyleDeclaration);
    expect(findScrollableAncestor(leaf)).toBe(root);
    fakeGet.mockRestore();
  });

  it('returns null when nothing scrolls', () => {
    const leaf = document.createElement('div');
    expect(findScrollableAncestor(leaf)).toBeNull();
  });
});
