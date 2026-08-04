import { renderHook } from '@testing-library/react';
import { useOrbitalPointer, type UseOrbitalPointerOptions } from './useOrbitalPointer';

const base: UseOrbitalPointerOptions = {
  badgeCenter: { x: 100, y: 100 },
  badgeSize: 40,
  pointerSize: 16,
  preset: 'right',
};

describe('useOrbitalPointer', () => {
  it('computes pointer center to the right for right preset', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 50, y: 150 },
      preset: 'right',
    }));
    expect(result.current.pointerCenter.x).toBeGreaterThan(50);
    expect(result.current.pointerCenter.y).toBe(150);
  });

  it('computes pointer center to the left for left preset', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 350, y: 150 },
      preset: 'left',
    }));
    expect(result.current.pointerCenter.x).toBeLessThan(350);
    expect(result.current.pointerCenter.y).toBe(150);
  });

  it('computes pointer center above for top preset', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 200, y: 250 },
      preset: 'top',
    }));
    expect(result.current.pointerCenter.x).toBe(200);
    expect(result.current.pointerCenter.y).toBeLessThan(250);
  });

  it('computes pointer center below for bottom preset', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 200, y: 50 },
      preset: 'bottom',
    }));
    expect(result.current.pointerCenter.x).toBe(200);
    expect(result.current.pointerCenter.y).toBeGreaterThan(50);
  });

  it('computes pointer center at badge center for center preset', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 200, y: 200 },
      preset: 'center',
    }));
    expect(result.current.pointerCenter.x).toBe(200);
    expect(result.current.pointerCenter.y).toBe(200);
  });

  it('computes pointer center and tip outside the badge', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 50, y: 150 },
      preset: 'right',
    }));
    expect(result.current.pointerCenter.x).toBeGreaterThan(50);
    expect(result.current.pointerTip.x).toBeGreaterThan(result.current.pointerCenter.x);
  });
});
