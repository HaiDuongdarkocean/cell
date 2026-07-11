import { SUBTITLE_BLOCK_REFERENCE_SIZE } from '@/shared/config/config';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { NavClusterSettings } from '@/entities/media';

export const SUBTITLE_BLOCK_MIN_FONT_SIZE = 8;
export const SUBTITLE_BLOCK_MAX_FONT_SIZE = 60;
export const SUBTITLE_BLOCK_MIN_BUTTON_SIZE = 20;
export const SUBTITLE_BLOCK_MAX_BUTTON_SIZE = 80;
export const SUBTITLE_BLOCK_CLUSTER_WIDTH_EXTRA = 12;

export function computeScaleFactor(width: number, height: number, reference = SUBTITLE_BLOCK_REFERENCE_SIZE): number {
  if (width <= 0 || height <= 0 || reference <= 0) return 1;
  return Math.sqrt(width * height) / reference;
}

export function computeScaledSize(
  baseSize: number,
  scaleFactor: number,
  globalScale: number,
  min: number,
  max: number,
): number {
  const value = baseSize * globalScale * scaleFactor;
  return Math.min(Math.max(value, min), max);
}

export interface ScaleSnapshot {
  targetFontSize: number;
  nativeFontSize: number;
  buttonSize: number;
  clusterWidth: number;
}

export function computeScaleSnapshot(
  width: number,
  height: number,
  targetStyle: OverlayStyleConfig,
  nativeStyle: OverlayStyleConfig,
  clusterButtonSize: NavClusterSettings['buttonSize'],
  globalScale: number,
): ScaleSnapshot {
  const scaleFactor = computeScaleFactor(width, height);
  const targetFontSize = computeScaledSize(
    targetStyle.fontSize,
    scaleFactor,
    globalScale,
    SUBTITLE_BLOCK_MIN_FONT_SIZE,
    SUBTITLE_BLOCK_MAX_FONT_SIZE,
  );
  const nativeFontSize = computeScaledSize(
    nativeStyle.fontSize,
    scaleFactor,
    globalScale,
    SUBTITLE_BLOCK_MIN_FONT_SIZE,
    SUBTITLE_BLOCK_MAX_FONT_SIZE,
  );
  const buttonSize = computeScaledSize(
    clusterButtonSize,
    scaleFactor,
    globalScale,
    SUBTITLE_BLOCK_MIN_BUTTON_SIZE,
    SUBTITLE_BLOCK_MAX_BUTTON_SIZE,
  );
  const clusterWidth = buttonSize * 2 + SUBTITLE_BLOCK_CLUSTER_WIDTH_EXTRA;
  return { targetFontSize, nativeFontSize, buttonSize, clusterWidth };
}

export function createBlockScaleObserver(
  container: HTMLElement,
  callback: (width: number, height: number) => void,
): ResizeObserver {
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const rect = entry.contentRect;
    callback(rect.width, rect.height);
  });
  ro.observe(container);
  return ro;
}
