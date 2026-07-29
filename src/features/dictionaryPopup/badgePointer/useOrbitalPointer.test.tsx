import { renderHook } from '@testing-library/react';
import { useOrbitalPointer, type UseOrbitalPointerOptions } from './useOrbitalPointer';

const base: UseOrbitalPointerOptions = {
  badgeCenter: { x: 100, y: 100 },
  badgeSize: 40,
  pointerSize: 16,
  viewportWidth: 400,
  viewportHeight: 300,
};

describe('useOrbitalPointer', () => {
  it('returns right preset when badge is left of viewport center', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 50, y: 150 },
    }));
    expect(result.current.preset).toBe('right');
  });

  it('returns left preset when badge is right of viewport center', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 350, y: 150 },
    }));
    expect(result.current.preset).toBe('left');
  });

  it('returns top preset when badge is below viewport center', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 200, y: 250 },
    }));
    expect(result.current.preset).toBe('top');
  });

  it('returns bottom preset when badge is above viewport center', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 200, y: 50 },
    }));
    expect(result.current.preset).toBe('bottom');
  });

  it('computes pointer center and tip outside the badge', () => {
    const { result } = renderHook(() => useOrbitalPointer({
      ...base,
      badgeCenter: { x: 50, y: 150 },
    }));
    expect(result.current.pointerCenter.x).toBeGreaterThan(50);
    expect(result.current.pointerTip.x).toBeGreaterThan(result.current.pointerCenter.x);
  });
});
