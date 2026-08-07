import { clampYOffset, dragDeltaToYOffset } from './subtitleBlockDrag';

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

  describe('dragDeltaToYOffset', () => {
    it('converts pixel delta to percent (no snap during drag)', () => {
      // start 50, delta 100px down, container 500px → +20% → 70
      expect(dragDeltaToYOffset(50, 100, 500)).toBe(70);
    });
    it('does not snap — keeps exact value', () => {
      // start 50, delta 60px, container 500px → +12% → 62 (no snap)
      expect(dragDeltaToYOffset(50, 60, 500)).toBe(62);
    });
    it('keeps value near former snap points (no snap on release)', () => {
      // 20/30/45/55/70/80 previously snapped to 25/50/75 — now stay exact
      expect(dragDeltaToYOffset(0, 100, 500)).toBe(20);
      expect(dragDeltaToYOffset(60, 75, 500)).toBe(75);
      expect(dragDeltaToYOffset(70, 50, 500)).toBe(80);
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
