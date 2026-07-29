import { renderHook } from '@testing-library/react';
import { useOrbitalSnap, type UseOrbitalSnapOptions } from './useOrbitalSnap';

const base: UseOrbitalSnapOptions = {
  badgeCenter: { x: 50, y: 200 },
  badgeSize: 40,
  viewport: { width: 400, height: 300 },
};

describe('useOrbitalSnap', () => {
  it('picks the nearest edge', () => {
    const { result } = renderHook(() => useOrbitalSnap(base));
    expect(result.current.edge).toBe('left');
  });

  it('returns collapsed and expanded centers', () => {
    const { result } = renderHook(() => useOrbitalSnap({
      ...base,
      badgeCenter: { x: 350, y: 200 },
    }));
    expect(result.current.edge).toBe('right');
    expect(result.current.expandedCenter.x).toBe(400);
    expect(result.current.collapsedCenter.x).toBeLessThan(result.current.expandedCenter.x);
  });
});
