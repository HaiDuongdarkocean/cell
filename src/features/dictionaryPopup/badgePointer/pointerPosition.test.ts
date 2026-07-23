import {
  angleToPreset,
  getPresetOffset,
  getPointerTip,
  angleToViewportCenter,
  DEFAULT_POINTER_RADIUS_PX,
} from './pointerPosition';

describe('angleToPreset', () => {
  it('maps rightward angle to right', () => {
    expect(angleToPreset(0)).toBe('right');
    expect(angleToPreset(-Math.PI / 4)).toBe('right'); // 315°
    expect(angleToPreset((7 * Math.PI) / 4)).toBe('right'); // 315°
  });

  it('maps leftward angle to left', () => {
    expect(angleToPreset(Math.PI)).toBe('left');
    expect(angleToPreset((3 * Math.PI) / 4)).toBe('left');
    expect(angleToPreset(-(3 * Math.PI) / 4)).toBe('left'); // -135° normalizes to 225°
    expect(angleToPreset(5 * Math.PI / 4)).toBe('left'); // 225° boundary
  });

  it('maps upward angle to top', () => {
    expect(angleToPreset(Math.PI / 2)).toBe('top');
    expect(angleToPreset(Math.PI / 3)).toBe('top');
    expect(angleToPreset((3 * Math.PI) / 4 - 0.1)).toBe('top');
  });

  it('maps downward angle to bottom', () => {
    expect(angleToPreset(-Math.PI / 2)).toBe('bottom'); // 270°
    expect(angleToPreset((4 * Math.PI) / 3)).toBe('bottom'); // 240°
    expect(angleToPreset((5 * Math.PI) / 3)).toBe('bottom'); // 300°
  });
});

describe('getPresetOffset', () => {
  it('returns offsets for each preset', () => {
    const r = 20;
    expect(getPresetOffset('right', r)).toEqual({ x: 20, y: 0 });
    expect(getPresetOffset('left', r)).toEqual({ x: -20, y: 0 });
    expect(getPresetOffset('top', r)).toEqual({ x: 0, y: -20 });
    expect(getPresetOffset('bottom', r)).toEqual({ x: 0, y: 20 });
    expect(getPresetOffset('center', r)).toEqual({ x: 0, y: 0 });
  });

  it('uses default radius', () => {
    expect(getPresetOffset('right')).toEqual({ x: DEFAULT_POINTER_RADIUS_PX, y: 0 });
  });
});

describe('getPointerTip', () => {
  it('adds offset to badge center', () => {
    expect(getPointerTip({ x: 100, y: 100 }, 'top', 18)).toEqual({ x: 100, y: 82 });
    expect(getPointerTip({ x: 100, y: 100 }, 'right', 18)).toEqual({ x: 118, y: 100 });
    expect(getPointerTip({ x: 100, y: 100 }, 'center', 18)).toEqual({ x: 100, y: 100 });
  });
});

describe('angleToViewportCenter', () => {
  it('points to center from right edge', () => {
    const angle = angleToViewportCenter(1900, 540, 1920, 1080);
    expect(Math.abs(angle)).toBeCloseTo(Math.PI, 2); // left (atan2 may return -PI)
  });

  it('points to center from bottom edge', () => {
    const angle = angleToViewportCenter(960, 1060, 1920, 1080);
    expect(angle).toBeCloseTo(Math.PI / 2, 2); // up (polar y-up)
  });

  it('returns 0 when badge is exactly at center', () => {
    expect(angleToViewportCenter(960, 540, 1920, 1080)).toBe(0);
  });
});
