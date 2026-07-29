import { useMemo } from 'react';
import {
  type PointerPreset,
  type Point,
  POINTER_EDGE_GAP_PX,
  computePointerOffset,
  angleToViewportCenter,
  angleToPreset,
  getPresetOffset,
} from './pointerPosition';

export interface UseOrbitalPointerOptions {
  badgeCenter: Point;
  badgeSize: number;
  pointerSize: number;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
}

export interface UseOrbitalPointerResult {
  preset: PointerPreset;
  pointerCenter: Point;
  pointerTip: Point;
}

export function useOrbitalPointer({
  badgeCenter,
  badgeSize,
  pointerSize,
  viewportWidth,
  viewportHeight,
  gap = POINTER_EDGE_GAP_PX,
}: UseOrbitalPointerOptions): UseOrbitalPointerResult {
  return useMemo(() => {
    const radius = computePointerOffset(badgeSize, pointerSize, gap);
    const angle = angleToViewportCenter(
      badgeCenter.x,
      badgeCenter.y,
      viewportWidth,
      viewportHeight,
    );
    const preset = angleToPreset(angle);
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
    return { preset, pointerCenter, pointerTip };
  }, [badgeCenter, badgeSize, pointerSize, viewportWidth, viewportHeight, gap]);
}
