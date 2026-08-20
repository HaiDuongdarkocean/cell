// lumaDiff — T10. Frame sampling: skip unchanged frames via luma difference.
// spec §AD5: Compare current frame luma with previous. If diff < threshold → skip OCR.

import type { ImageSource } from '@/features/ocr/engine/types';

/** Compute mean luma of a sub-region (for subtitle area only — saves O(n) on full frame). */
export function regionMeanLuma(
  image: ImageSource,
  region: { x: number; y: number; width: number; height: number },
): number {
  const { data, width: imgWidth } = image;
  let sum = 0;
  let count = 0;
  const startX = Math.max(0, Math.floor(region.x));
  const startY = Math.max(0, Math.floor(region.y));
  const endX = Math.min(imgWidth, startX + Math.floor(region.width));
  const endY = Math.min(image.height, startY + Math.floor(region.height));

  for (let y = startY; y < endY; y += 2) {  // Sample every 2nd row for speed.
    for (let x = startX; x < endX; x += 2) {  // Sample every 2nd col.
      const idx = (y * imgWidth + x) * 4;
      sum += 0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]!;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/** Compute absolute luma difference between two values. */
export function lumaDiff(a: number, b: number): number {
  return Math.abs(a - b);
}

/** Check if the subtitle region has changed enough to warrant OCR. */
export function shouldRunOcr(
  currentLuma: number,
  previousLuma: number | null,
  threshold = 3,
): boolean {
  if (previousLuma === null) return true;  // First frame always runs.
  return lumaDiff(currentLuma, previousLuma) > threshold;
}

/** Compute a simple pHash (perceptual hash) for text dedup.
 *  Returns a 64-bit hash as a hex string. Two frames with same text → same hash. */
export function subtitleRegionHash(
  image: ImageSource,
  region: { x: number; y: number; width: number; height: number },
): string {
  const { data, width: imgWidth } = image;
  // Downscale region to 8x8 = 64 pixels, compute average, then hash bits.
  const startX = Math.max(0, Math.floor(region.x));
  const startY = Math.max(0, Math.floor(region.y));
  const endX = Math.min(imgWidth, startX + Math.floor(region.width));
  const endY = Math.min(image.height, startY + Math.floor(region.height));
  const regionW = endX - startX;
  const regionH = endY - startY;
  if (regionW <= 0 || regionH <= 0) return '0';

  // Sample 8x8 grid.
  const grid: number[] = [];
  let sum = 0;
  for (let gy = 0; gy < 8; gy++) {
    for (let gx = 0; gx < 8; gx++) {
      const x = startX + Math.floor((gx / 8) * regionW);
      const y = startY + Math.floor((gy / 8) * regionH);
      const idx = (y * imgWidth + x) * 4;
      const luma = 0.299 * data[idx]! + 0.587 * data[idx + 1]! + 0.114 * data[idx + 2]!;
      grid.push(luma);
      sum += luma;
    }
  }
  const avg = sum / 64;

  // Build hash: bit = 1 if pixel > avg.
  let hash = 0n;
  for (let i = 0; i < 64; i++) {
    if (grid[i]! > avg) hash |= (1n << BigInt(i));
  }
  return hash.toString(16).padStart(16, '0');
}
