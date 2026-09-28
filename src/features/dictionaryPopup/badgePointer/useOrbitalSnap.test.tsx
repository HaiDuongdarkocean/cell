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
    // collapsedCenter insets by half the badge → full circle docked inside.
    expect(result.current.collapsedCenter).toEqual({ x: 380, y: 200 });
  });

  it.each([
    [{ x: 20, y: 200 }, 'left', { x: 20, y: 200 }],
    [{ x: 380, y: 200 }, 'right', { x: 380, y: 200 }],
    [{ x: 200, y: 20 }, 'top', { x: 200, y: 20 }],
    [{ x: 200, y: 280 }, 'bottom', { x: 200, y: 280 }],
  ] as const)('docks %s fully inside the %s edge', (badgeCenter, edge, expected) => {
    const { result } = renderHook(() => useOrbitalSnap({ ...base, badgeCenter }));
    expect(result.current.edge).toBe(edge);
    expect(result.current.collapsedCenter).toEqual(expected);
  });
});
