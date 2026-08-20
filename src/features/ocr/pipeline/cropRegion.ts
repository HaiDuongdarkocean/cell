// cropRegion — T11. Crop subtitle region from full frame.
// spec §AD5: Bottom 15% of video by default, configurable per-origin.

import type { ImageSource } from '@/features/ocr/engine/types';

/** Crop region spec — x, y, width, height in pixels. */
export interface CropRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Compute subtitle crop region from full frame dimensions.
 *  @param imageWidth Full frame width.
 *  @param imageHeight Full frame height.
 *  @param regionPct Percentage of height from bottom (default 15). */
export function computeSubtitleRegion(
  imageWidth: number,
  imageHeight: number,
  regionPct = 15,
): CropRegion {
  const regionHeight = Math.floor(imageHeight * regionPct / 100);
  return {
    x: 0,
    y: imageHeight - regionHeight,
    width: imageWidth,
    height: regionHeight,
  };
}

/** Crop a sub-region from an ImageSource. Returns a new ImageSource with only the cropped area. */
export function cropImage(image: ImageSource, region: CropRegion): ImageSource {
  const { data, width: srcWidth } = image;
  const startX = Math.max(0, Math.floor(region.x));
  const startY = Math.max(0, Math.floor(region.y));
  const endX = Math.min(srcWidth, startX + Math.floor(region.width));
  const endY = Math.min(image.height, startY + Math.floor(region.height));
  const cropWidth = endX - startX;
  const cropHeight = endY - startY;

  if (cropWidth <= 0 || cropHeight <= 0) {
    return { data: new Uint8ClampedArray(0), width: 0, height: 0 };
  }

  const cropped = new Uint8ClampedArray(cropWidth * cropHeight * 4);
  for (let y = 0; y < cropHeight; y++) {
    const srcRowStart = ((startY + y) * srcWidth + startX) * 4;
    const dstRowStart = y * cropWidth * 4;
    cropped.set(data.subarray(srcRowStart, srcRowStart + cropWidth * 4), dstRowStart);
  }

  return { data: cropped, width: cropWidth, height: cropHeight };
}
