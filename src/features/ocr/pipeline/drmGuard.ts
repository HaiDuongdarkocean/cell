// drmGuard — T9. Detect DRM-protected black frames.
// spec §AD2: If canvas.drawImage(video) produces a black frame → DRM-protected.
// themoviebox.xyz/kisskh.co NOT DRM (verified T0b). Netflix/Disney+ are DRM.

import type { ImageSource } from '@/features/ocr/engine/types';

/** Mean luma of an image. DRM black frames have mean luma < 5. */
export function meanLuma(image: ImageSource): number {
  const { data, width, height } = image;
  let sum = 0;
  const pixelCount = width * height;
  // Sample every 4th pixel for speed (O(n/4) → still O(n) but 4x faster).
  for (let i = 0; i < data.length; i += 16) {
    // RGBA → luma: 0.299R + 0.587G + 0.114B
    sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  }
  return sum / (pixelCount / 4);
}

/** Check if a frame is a DRM black frame (mean luma < threshold). */
export function isBlackFrame(image: ImageSource, threshold = 5): boolean {
  return meanLuma(image) < threshold;
}

/** DRM guard result. */
export interface DrmGuardResult {
  readonly isDrm: boolean;
  readonly meanLuma: number;
}

/** Check frame for DRM protection. Returns result + luma for logging. */
export function checkDrmGuard(image: ImageSource, threshold = 5): DrmGuardResult {
  const luma = meanLuma(image);
  return { isDrm: luma < threshold, meanLuma: luma };
}
