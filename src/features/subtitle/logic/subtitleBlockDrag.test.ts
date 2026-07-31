import { clampYOffset, snapYOffset, dragDeltaToYOffset } from './subtitleBlockDrag';

describe('subtitleBlockDrag', () => {
  describe('clampYOffset', () => {
    it('clamps below 0 to 0', () => {
      expect(clampYOffset(-10)).toBe(0);
    });
    it('clamps above 95 to 95', () => {
      expect(clampYOffset(120)).toBe(95);
    });
    it('keeps value in range', () => {
      expect(clampYOffset(50)).toBe(50);
    });
    it('returns 0 for NaN', () => {
      expect(clampYOffset(NaN)).toBe(0);
    });
  });

  describe('snapYOffset', () => {
    it('snaps to 25 when within threshold', () => {
      expect(snapYOffset(20)).toBe(25);
      expect(snapYOffset(30)).toBe(25);
    });
    it('snaps to 50 when within threshold', () => {
      expect(snapYOffset(45)).toBe(50);
      expect(snapYOffset(55)).toBe(50);
    });
    it('snaps to 75 when within threshold', () => {
      expect(snapYOffset(70)).toBe(75);
      expect(snapYOffset(80)).toBe(75);
    });
    it('keeps value when outside snap points', () => {
      expect(snapYOffset(40)).toBe(40);
      expect(snapYOffset(60)).toBe(60);
    });
  });

  describe('dragDeltaToYOffset', () => {
    it('converts pixel delta to percent + snaps near 75', () => {
      // start 50, delta 100px down, container 500px → +20% → 70 → snap to 75 (within ±8)
      expect(dragDeltaToYOffset(50, 100, 500)).toBe(75);
    });
    it('does not snap when far from snap points', () => {
      // start 50, delta 60px, container 500px → +12% → 62 (not within ±8 of any snap)
      expect(dragDeltaToYOffset(50, 60, 500)).toBe(62);
    });
    it('clamps to 0', () => {
      expect(dragDeltaToYOffset(10, -200, 500)).toBe(0);
    });
    it('clamps to 95', () => {
      expect(dragDeltaToYOffset(90, 200, 500)).toBe(95);
    });
    it('returns clamped start when container height <= 0', () => {
      expect(dragDeltaToYOffset(50, 100, 0)).toBe(50);
      expect(dragDeltaToYOffset(50, 100, -1)).toBe(50);
    });
  });
});
