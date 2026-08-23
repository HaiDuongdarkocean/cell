// drmGuard tests — T9.

import { describe, expect, it } from '@jest/globals';
import { meanLuma, isBlackFrame, checkDrmGuard } from './drmGuard';
import type { ImageSource } from '@/features/ocr/engine/types';

function makeImage(width: number, height: number, fillValue: number): ImageSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue;     // R
    data[i + 1] = fillValue; // G
    data[i + 2] = fillValue; // B
    data[i + 3] = 255;       // A
  }
  return { data, width, height };
}

describe('drmGuard (T9)', () => {
  it('meanLuma returns ~0 for black frame', () => {
    const img = makeImage(100, 100, 0);
    expect(meanLuma(img)).toBeCloseTo(0, 0);
  });

  it('meanLuma returns ~255 for white frame', () => {
    const img = makeImage(100, 100, 255);
    expect(meanLuma(img)).toBeCloseTo(255, 0);
  });

  it('meanLuma returns ~128 for gray frame', () => {
    const img = makeImage(100, 100, 128);
    expect(meanLuma(img)).toBeCloseTo(128, 0);
  });

  it('isBlackFrame true for black frame', () => {
    const img = makeImage(100, 100, 0);
    expect(isBlackFrame(img)).toBe(true);
  });

  it('isBlackFrame false for normal frame', () => {
    const img = makeImage(100, 100, 100);
    expect(isBlackFrame(img)).toBe(false);
  });

  it('checkDrmGuard detects DRM black frame', () => {
    const img = makeImage(100, 100, 0);
    const result = checkDrmGuard(img);
    expect(result.isDrm).toBe(true);
    expect(result.meanLuma).toBeCloseTo(0, 0);
  });

  it('checkDrmGuard passes normal frame', () => {
    const img = makeImage(100, 100, 100);
    const result = checkDrmGuard(img);
    expect(result.isDrm).toBe(false);
    expect(result.meanLuma).toBeCloseTo(100, 0);
  });

  it('checkDrmGuard uses custom threshold', () => {
    const img = makeImage(100, 100, 10);
    expect(checkDrmGuard(img, 5).isDrm).toBe(false);   // 10 > 5 → not DRM
    expect(checkDrmGuard(img, 20).isDrm).toBe(true);   // 10 < 20 → DRM
  });
});
