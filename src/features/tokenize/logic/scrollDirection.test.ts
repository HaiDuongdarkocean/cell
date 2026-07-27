import { describe, expect, it } from '@jest/globals';
import { resolveScrollPredictMargin } from './scrollDirection';

describe('resolveScrollPredictMargin', () => {
  it('returns down direction with deep ahead bottom when scrolling down', () => {
    const result = resolveScrollPredictMargin({
      scrollY: 1000,
      lastScrollY: 500,
      viewportHeight: 800,
    });
    expect(result.direction).toBe('down');
    // rootMargin = "top right bottom left" → deep ahead at bottom
    const parts = result.rootMargin.split(' ');
    expect(parts).toHaveLength(4);
    const topPx = parseInt(parts[0]!, 10);
    const bottomPx = parseInt(parts[2]!, 10);
    expect(bottomPx).toBeGreaterThan(topPx);
  });

  it('returns up direction with deep ahead top when scrolling up', () => {
    const result = resolveScrollPredictMargin({
      scrollY: 500,
      lastScrollY: 1000,
      viewportHeight: 800,
    });
    expect(result.direction).toBe('up');
    const parts = result.rootMargin.split(' ');
    const topPx = parseInt(parts[0]!, 10);
    const bottomPx = parseInt(parts[2]!, 10);
    expect(topPx).toBeGreaterThan(bottomPx);
  });

  it('returns none direction when delta is below hysteresis', () => {
    const result = resolveScrollPredictMargin({
      scrollY: 516,
      lastScrollY: 500,
      viewportHeight: 800,
      hysteresisPx: 20,
    });
    expect(result.direction).toBe('none');
  });

  it('keeps lastDirection when delta is below hysteresis', () => {
    const result = resolveScrollPredictMargin({
      scrollY: 516,
      lastScrollY: 500,
      viewportHeight: 800,
      hysteresisPx: 20,
      lastDirection: 'down',
    });
    expect(result.direction).toBe('down');
  });

  it('returns isotropic margin when direction is none and no lastDirection', () => {
    const result = resolveScrollPredictMargin({
      scrollY: 500,
      lastScrollY: 500,
      viewportHeight: 800,
    });
    expect(result.direction).toBe('none');
    const parts = result.rootMargin.split(' ');
    const topPx = parseInt(parts[0]!, 10);
    const bottomPx = parseInt(parts[2]!, 10);
    expect(topPx).toBe(bottomPx);
  });

  it('floors ahead to minAheadPx when viewport is short', () => {
    const result = resolveScrollPredictMargin({
      scrollY: 1000,
      lastScrollY: 500,
      viewportHeight: 300, // 1.0 × 300 = 300 < minAhead 600
      minAheadPx: 600,
    });
    const parts = result.rootMargin.split(' ');
    const bottomPx = parseInt(parts[2]!, 10);
    expect(bottomPx).toBeGreaterThanOrEqual(600);
  });

  it('floors behind to minBehindPx when viewport is short', () => {
    const result = resolveScrollPredictMargin({
      scrollY: 1000,
      lastScrollY: 500,
      viewportHeight: 300, // 0.25 × 300 = 75 < minBehind 150
      minBehindPx: 150,
    });
    const parts = result.rootMargin.split(' ');
    const topPx = parseInt(parts[0]!, 10);
    expect(topPx).toBeGreaterThanOrEqual(150);
  });

  it('produces valid CSS rootMargin with px units', () => {
    const result = resolveScrollPredictMargin({
      scrollY: 1000,
      lastScrollY: 500,
      viewportHeight: 800,
    });
    expect(result.rootMargin).toMatch(/^\d+px 0 \d+px 0$/);
  });

  it('uses custom aheadScreens multiplier', () => {
    const result = resolveScrollPredictMargin({
      scrollY: 1000,
      lastScrollY: 500,
      viewportHeight: 800,
      aheadScreens: 1.5,
    });
    const parts = result.rootMargin.split(' ');
    const bottomPx = parseInt(parts[2]!, 10);
    expect(bottomPx).toBe(1200); // 1.5 × 800
  });

  it('left and right margins are always 0px (vertical scroll only)', () => {
    const down = resolveScrollPredictMargin({ scrollY: 1000, lastScrollY: 500, viewportHeight: 800 });
    const up = resolveScrollPredictMargin({ scrollY: 500, lastScrollY: 1000, viewportHeight: 800 });
    const none = resolveScrollPredictMargin({ scrollY: 500, lastScrollY: 500, viewportHeight: 800 });
    for (const r of [down, up, none]) {
      const parts = r.rootMargin.split(' ');
      expect(parts[1]).toBe('0');
      expect(parts[3]).toBe('0');
    }
  });
});
