import { useMemo } from 'react';
import {
  type PointerPreset,
  type Point,
  POINTER_EDGE_GAP_PX,
  computePointerOffset,
  computePointerOffsetInside,
  getPresetOffset,
} from './pointerPosition';

export interface UseOrbitalPointerOptions {
  badgeCenter: Point;
  badgeSize: number;
  pointerSize: number;
  /** Explicit preset — pointer stays at this fixed position (no auto-angle). */
  preset: PointerPreset;
  gap?: number;
  /** Place pointer INSIDE the badge (for collapsed half-moon) instead of outside. */
  inside?: boolean;
}

export interface UseOrbitalPointerResult {
  pointerCenter: Point;
  pointerTip: Point;
}

export function useOrbitalPointer({
  badgeCenter,
  badgeSize,
  pointerSize,
  preset,
  gap = POINTER_EDGE_GAP_PX,
  inside = false,
}: UseOrbitalPointerOptions): UseOrbitalPointerResult {
  return useMemo(() => {
    const radius = inside
      ? computePointerOffsetInside(badgeSize, pointerSize, gap)
      : computePointerOffset(badgeSize, pointerSize, gap);
    const offset = getPresetOffset(preset, radius);
    const pointerCenter: Point = {
      x: badgeCenter.x + offset.x,
      y: badgeCenter.y + offset.y,
    };
    const tipRadius = radius + pointerSize / 2;
    const tipOffset = getPresetOffset(preset, tipRadius);
    const pointerTip: Point = {
      x: badgeCenter.x + tipOffset.x,
      y: badgeCenter.y + tipOffset.y,
    };
    return { pointerCenter, pointerTip };
  }, [badgeCenter, badgeSize, pointerSize, preset, gap, inside]);
}
