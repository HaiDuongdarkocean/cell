import {
  togglePlayerMode,
  clampDockHeight,
  clampDictionarySheetHeight,
  resolvePlayerModeLayout,
  resolveVideoAspectRatio,
  resolvePlayerModeHostStyles,
  resolvePlayerModeVideoStyles,
  DOCK_MIN_HEIGHT_PX,
  SHEET_MIN_HEIGHT_PX,
} from './playerModeGeometry';

describe('playerModeGeometry', () => {
  describe('togglePlayerMode', () => {
    it('turns on when off', () => {
      expect(togglePlayerMode(false)).toBe(true);
    });
    it('turns off when on', () => {
      expect(togglePlayerMode(true)).toBe(false);
    });
  });

  describe('clampDockHeight', () => {
    it('returns min for NaN inputs', () => {
      expect(clampDockHeight(NaN, 800)).toBe(DOCK_MIN_HEIGHT_PX);
      expect(clampDockHeight(200, NaN)).toBe(DOCK_MIN_HEIGHT_PX);
    });
    it('returns min when viewport <= 0', () => {
      expect(clampDockHeight(200, 0)).toBe(DOCK_MIN_HEIGHT_PX);
      expect(clampDockHeight(200, -10)).toBe(DOCK_MIN_HEIGHT_PX);
    });
    it('clamps below min to min', () => {
      expect(clampDockHeight(50, 800)).toBe(DOCK_MIN_HEIGHT_PX);
    });
    it('keeps value within range', () => {
      expect(clampDockHeight(160, 800)).toBe(160);
    });
    it('clamps above 35% of viewport', () => {
      // 35% of 800 = 280
      expect(clampDockHeight(400, 800)).toBe(280);
    });
    it('never lets max fall below min on tiny viewports', () => {
      // 35% of 200 = 70 < 160 → max becomes 160
      expect(clampDockHeight(200, 200)).toBe(160);
    });
  });

  describe('clampDictionarySheetHeight', () => {
    it('returns min for NaN inputs', () => {
      expect(clampDictionarySheetHeight(NaN, 800, 160)).toBe(SHEET_MIN_HEIGHT_PX);
      expect(clampDictionarySheetHeight(400, NaN, 160)).toBe(SHEET_MIN_HEIGHT_PX);
    });
    it('returns min when viewport <= 0', () => {
      expect(clampDictionarySheetHeight(400, 0, 160)).toBe(SHEET_MIN_HEIGHT_PX);
    });
    it('clamps below min to min', () => {
      expect(clampDictionarySheetHeight(50, 800, 160)).toBe(SHEET_MIN_HEIGHT_PX);
    });
    it('clamps above available region (viewport - dock)', () => {
      // available = 800 - 160 = 640; max = 640
      expect(clampDictionarySheetHeight(900, 800, 160)).toBe(640);
    });
    it('treats negative dock as 0', () => {
      // available = 800 - 0 = 800
      expect(clampDictionarySheetHeight(900, 800, -50)).toBe(800);
    });
    it('keeps value within range', () => {
      expect(clampDictionarySheetHeight(400, 800, 160)).toBe(400);
    });
    it('never covers the dock on tiny viewports', () => {
      // viewport 200, dock 160 → available 72 < min 160 → upper bound = 160
      expect(clampDictionarySheetHeight(180, 200, 160)).toBe(160);
    });
  });

  describe('resolveVideoAspectRatio', () => {
    it('uses native video dimensions when valid', () => {
      expect(resolveVideoAspectRatio(1920, 1080)).toBeCloseTo(16 / 9);
    });
    it('uses fallback for invalid dimensions', () => {
      expect(resolveVideoAspectRatio(0, 0)).toBeCloseTo(16 / 9);
      expect(resolveVideoAspectRatio(1920, 0, 4 / 3)).toBeCloseTo(4 / 3);
    });
  });

  describe('resolvePlayerModeHostStyles', () => {
    it('returns empty styles (container not modified)', () => {
      expect(resolvePlayerModeHostStyles(270)).toEqual({});
    });
  });

  describe('resolvePlayerModeVideoStyles', () => {
    it('returns empty styles (canvas capture — video not modified)', () => {
      expect(resolvePlayerModeVideoStyles()).toEqual({});
    });
  });

  describe('resolvePlayerModeLayout', () => {
    it('returns zero video/content for degenerate viewport', () => {
      const layout = resolvePlayerModeLayout(0, 0, 16 / 9, 160);
      expect(layout.videoStageHeight).toBe(0);
      expect(layout.contentOtherHeight).toBe(0);
      expect(layout.dockHeight).toBe(DOCK_MIN_HEIGHT_PX);
    });
    it('falls back to 16/9 when aspect ratio invalid', () => {
      const layout = resolvePlayerModeLayout(360, 800, NaN, 160);
      // 360 / (16/9) = 202.5 → cap 60% of 800 = 480 → 202.5
      expect(layout.videoStageHeight).toBeCloseTo(202.5, 0);
    });
    it('caps video at 60% of viewport for tall videos', () => {
      // 9:16 portrait video on 360x800 → intrinsic 640 → cap 480
      const layout = resolvePlayerModeLayout(360, 800, 9 / 16, 160);
      expect(layout.videoStageHeight).toBe(480);
    });
    it('contentOther fills remaining space', () => {
      // 360x800, 16:9 → video 202.5, dock 160 → content = 800 - 202.5 - 160 = 437.5
      const layout = resolvePlayerModeLayout(360, 800, 16 / 9, 160);
      expect(layout.contentOtherHeight).toBeCloseTo(437.5, 0);
    });
    it('contentOther never goes negative when dock + video exceed viewport', () => {
      // tiny viewport, large dock request
      const layout = resolvePlayerModeLayout(320, 400, 16 / 9, 300);
      expect(layout.contentOtherHeight).toBeGreaterThanOrEqual(0);
    });
    it('clamps dock height before computing regions', () => {
      const layout = resolvePlayerModeLayout(360, 800, 16 / 9, 9999);
      // dock clamped to 35% of 800 = 280
      expect(layout.dockHeight).toBe(280);
    });
    it('320px mobile: video + content + dock sum to viewport', () => {
      const layout = resolvePlayerModeLayout(320, 568, 16 / 9, 160);
      const sum = layout.videoStageHeight + layout.contentOtherHeight + layout.dockHeight;
      expect(sum).toBeCloseTo(568, 0);
    });
    it('480px mobile: video + content + dock sum to viewport', () => {
      const layout = resolvePlayerModeLayout(480, 854, 16 / 9, 160);
      const sum = layout.videoStageHeight + layout.contentOtherHeight + layout.dockHeight;
      expect(sum).toBeCloseTo(854, 0);
    });
  });
});
