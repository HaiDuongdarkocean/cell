import { compareHlc, HybridClock, hlcEq, maxHlc } from './hlc';
import type { Hlc } from './types';

const h = (wall: number, counter = 0, node = 'a'): Hlc => ({ wall, counter, node });

describe('compareHlc', () => {
  it('orders by wall then counter then node', () => {
    expect(compareHlc(h(1), h(2))).toBeLessThan(0);
    expect(compareHlc(h(2, 0), h(2, 1))).toBeLessThan(0);
    expect(compareHlc(h(2, 0, 'a'), h(2, 0, 'b'))).toBeLessThan(0);
    expect(hlcEq(h(2, 1, 'a'), h(2, 1, 'a'))).toBe(true);
  });

  it('is a total order over random stamps', () => {
    const nodes = ['a', 'b', 'c'];
    const stamps: Hlc[] = [];
    for (let i = 0; i < 300; i += 1) {
      stamps.push(h(
        Math.floor(Math.random() * 5),
        Math.floor(Math.random() * 5),
        nodes[i % 3],
      ));
    }
    for (const a of stamps) {
      for (const b of stamps) {
        const ab = compareHlc(a, b);
        const ba = compareHlc(b, a);
        expect(ab === 0 ? ba === 0 : Math.sign(ab) === -Math.sign(ba)).toBe(true);
        if (ab === 0) expect(a).toEqual(b);
        for (const c of stamps.slice(0, 5)) {
          if (ab <= 0 && compareHlc(b, c) <= 0) {
            expect(compareHlc(a, c)).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });

  it('maxHlc returns the later stamp', () => {
    expect(maxHlc(h(1, 9), h(2, 0))).toEqual(h(2, 0));
    expect(maxHlc(h(5, 0, 'b'), h(5, 0, 'a'))).toEqual(h(5, 0, 'b'));
  });
});

describe('HybridClock', () => {
  it('monotonic within same wall ms', () => {
    const clock = new HybridClock('d1:c1', () => 1000);
    const a = clock.tick();
    const b = clock.tick();
    expect(compareHlc(a, b)).toBeLessThan(0);
    expect(b.counter).toBe(1);
  });

  it('never goes backward when Date.now stalls', () => {
    let t = 1000;
    const clock = new HybridClock('d1:c1', () => t);
    clock.tick();
    t = 500;
    const next = clock.tick();
    expect(next.wall).toBe(1000);
    expect(next.counter).toBe(1);
  });

  it('seeds wall floor and observes remote stamps', () => {
    const clock = new HybridClock('d1:c1', () => 10, 9000);
    const first = clock.tick();
    expect(first.wall).toBe(9000);
    clock.observe(h(9500, 7, 'peer'));
    const after = clock.tick();
    expect(after.wall).toBe(9500);
    expect(after.counter).toBe(8);
  });
});
