// lumaDiff + cropRegion tests — T10, T11.

import { describe, expect, it } from '@jest/globals';
import { regionMeanLuma, shouldRunOcr, subtitleRegionHash } from './lumaDiff';
import { computeSubtitleRegion, cropImage, type CropRegion } from './cropRegion';
import type { ImageSource } from '@/features/ocr/engine/types';

function makeImage(width: number, height: number, fillValue: number): ImageSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue;
    data[i + 1] = fillValue;
    data[i + 2] = fillValue;
    data[i + 3] = 255;
  }
  return { data, width, height };
}

function makeImageWithRegion(
  width: number, height: number,
  bgValue: number,
  region: CropRegion,
  regionValue: number,
): ImageSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bgValue; data[i + 1] = bgValue; data[i + 2] = bgValue; data[i + 3] = 255;
  }
  // Fill region.
  for (let y = region.y; y < region.y + region.height && y < height; y++) {
    for (let x = region.x; x < region.x + region.width && x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = regionValue; data[idx + 1] = regionValue; data[idx + 2] = regionValue;
    }
  }
  return { data, width, height };
}

describe('lumaDiff (T10)', () => {
  it('regionMeanLuma returns correct value for uniform region', () => {
    const img = makeImage(100, 100, 128);
    const region = { x: 0, y: 0, width: 100, height: 100 };
    expect(regionMeanLuma(img, region)).toBeCloseTo(128, 0);
  });

  it('regionMeanLuma returns different value for subtitle area', () => {
    const region = { x: 0, y: 85, width: 100, height: 15 };
    const img = makeImageWithRegion(100, 100, 50, region, 200);
    const luma = regionMeanLuma(img, region);
    expect(luma).toBeGreaterThan(150);
  });

  it('shouldRunOcr true for first frame', () => {
    expect(shouldRunOcr(100, null)).toBe(true);
  });

  it('shouldRunOcr false when luma unchanged', () => {
    expect(shouldRunOcr(100, 100)).toBe(false);
  });

  it('shouldRunOcr true when luma changes beyond threshold', () => {
    expect(shouldRunOcr(110, 100, 5)).toBe(true);
  });

  it('shouldRunOcr false when luma changes within threshold', () => {
    expect(shouldRunOcr(103, 100, 5)).toBe(false);
  });

  it('subtitleRegionHash returns same hash for identical frames', () => {
    const region = { x: 0, y: 85, width: 100, height: 15 };
    const img1 = makeImageWithRegion(100, 100, 50, region, 200);
    const img2 = makeImageWithRegion(100, 100, 50, region, 200);
    expect(subtitleRegionHash(img1, region)).toBe(subtitleRegionHash(img2, region));
  });

  it('subtitleRegionHash returns different hash for different text patterns', () => {
    const region = { x: 0, y: 85, width: 100, height: 15 };
    // Create two images with different patterns (not just uniform fill).
    const img1 = makeImageWithRegion(100, 100, 50, region, 200);
    // Make img2 with a striped pattern in the subtitle region.
    const data2 = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < data2.length; i += 4) {
      data2[i] = 50; data2[i + 1] = 50; data2[i + 2] = 50; data2[i + 3] = 255;
    }
    for (let y = 85; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (y * 100 + x) * 4;
        const v = x % 2 === 0 ? 200 : 50;  // Alternating pattern.
        data2[idx] = v; data2[idx + 1] = v; data2[idx + 2] = v;
      }
    }
    const img2 = { data: data2, width: 100, height: 100 };
    expect(subtitleRegionHash(img1, region)).not.toBe(subtitleRegionHash(img2, region));
  });
});

describe('cropRegion (T11)', () => {
  it('computeSubtitleRegion returns bottom 15% by default', () => {
    const region = computeSubtitleRegion(1280, 720);
    expect(region.x).toBe(0);
    expect(region.width).toBe(1280);
    expect(region.height).toBe(108);  // 720 * 0.15 = 108
    expect(region.y).toBe(612);       // 720 - 108 = 612
  });

  it('computeSubtitleRegion respects custom percentage', () => {
    const region = computeSubtitleRegion(1280, 720, 20);
    expect(region.height).toBe(144);  // 720 * 0.20 = 144
    expect(region.y).toBe(576);       // 720 - 144 = 576
  });

  it('cropImage returns cropped ImageSource', () => {
    const img = makeImageWithRegion(100, 100, 50, { x: 0, y: 85, width: 100, height: 15 }, 200);
    const region = computeSubtitleRegion(100, 100, 15);
    const cropped = cropImage(img, region);
    expect(cropped.width).toBe(100);
    expect(cropped.height).toBe(15);
    expect(cropped.data.length).toBe(100 * 15 * 4);
  });

  it('cropImage returns empty for invalid region', () => {
    const img = makeImage(100, 100, 50);
    const cropped = cropImage(img, { x: 200, y: 200, width: 10, height: 10 });
    expect(cropped.width).toBe(0);
    expect(cropped.height).toBe(0);
  });
});
