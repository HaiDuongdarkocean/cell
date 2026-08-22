// regionMapping tests — the algorithm that fixes "OCR scan sai vùng".
//
// Covers: all 5 object-fit values, object-position, video offset within shell,
// identity case, round-trip (shell↔intrinsic), the two real bug scenarios
// (16:9 video in 4:3 pillarbox + 21:9 letterbox), and degenerate inputs.

import { describe, expect, it } from '@jest/globals';
import {
  parseObjectPosition,
  computeContentRect,
  mapShellToIntrinsic,
  mapIntrinsicToShell,
  clampRegion,
  type PixelRect,
  type IntrinsicSize,
  type ObjectPosition,
  type ObjectFit,
} from './regionMapping';
import type { CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';

const approx = (actual: number, expected: number, eps = 1e-6): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(eps);
};

const regionApprox = (actual: CustomRegion, expected: CustomRegion, eps = 1e-6): void => {
  approx(actual.xPct, expected.xPct, eps);
  approx(actual.yPct, expected.yPct, eps);
  approx(actual.widthPct, expected.widthPct, eps);
  approx(actual.heightPct, expected.heightPct, eps);
};

// 16:9 video (the test video "How Have You Been.mp4" is 1920×1080).
const VIDEO_16_9: IntrinsicSize = { width: 1920, height: 1080 };
// A 4:3 box (pillarbox a 16:9 video → black bars left/right).
const BOX_4_3: PixelRect = { left: 0, top: 0, width: 1200, height: 900 };
// A 21:9 box (letterbox a 16:9 video → black bars top/bottom).
const BOX_21_9: PixelRect = { left: 0, top: 0, width: 1890, height: 810 };
const CENTER: ObjectPosition = { x: 0.5, y: 0.5 };

describe('parseObjectPosition', () => {
  it('defaults to center for empty / invalid', () => {
    expect(parseObjectPosition('')).toEqual({ x: 0.5, y: 0.5 });
    expect(parseObjectPosition('garbage')).toEqual({ x: 0.5, y: 0.5 });
  });

  it('parses two percentages', () => {
    expect(parseObjectPosition('25% 75%')).toEqual({ x: 0.25, y: 0.75 });
    expect(parseObjectPosition('0% 100%')).toEqual({ x: 0, y: 1 });
  });

  it('parses keywords', () => {
    expect(parseObjectPosition('left top')).toEqual({ x: 0, y: 0 });
    expect(parseObjectPosition('right bottom')).toEqual({ x: 1, y: 1 });
    expect(parseObjectPosition('center center')).toEqual({ x: 0.5, y: 0.5 });
  });

  it('one horizontal value → y defaults to center', () => {
    expect(parseObjectPosition('25%')).toEqual({ x: 0.25, y: 0.5 });
    expect(parseObjectPosition('left')).toEqual({ x: 0, y: 0.5 });
  });

  it('one vertical keyword → x defaults to center', () => {
    expect(parseObjectPosition('top')).toEqual({ x: 0.5, y: 0 });
    expect(parseObjectPosition('bottom')).toEqual({ x: 0.5, y: 1 });
  });

  it('clamps out-of-range percentages', () => {
    expect(parseObjectPosition('200% -50%')).toEqual({ x: 1, y: 0 });
  });
});

describe('computeContentRect', () => {
  it('fill → content = box', () => {
    const r = computeContentRect(BOX_4_3, VIDEO_16_9, 'fill', CENTER);
    expect(r).toEqual({ cx: 0, cy: 0, cw: 1200, ch: 900 });
  });

  it('contain on 4:3 box (16:9 video) → pillarbox: black bars left/right', () => {
    // scale = min(1200/1920, 900/1080) = min(0.625, 0.8333) = 0.625
    // cw = 1920*0.625 = 1200, ch = 1080*0.625 = 675
    // leftover_h = 900-675 = 225 → cy = 225*0.5 = 112.5
    const r = computeContentRect(BOX_4_3, VIDEO_16_9, 'contain', CENTER);
    approx(r.cw, 1200);
    approx(r.ch, 675);
    approx(r.cx, 0);
    approx(r.cy, 112.5);
  });

  it('contain on 21:9 box (16:9 video) → letterbox: black bars top/bottom', () => {
    // scale = min(1890/1920, 810/1080) = min(0.9844, 0.75) = 0.75
    // cw = 1920*0.75 = 1440, ch = 1080*0.75 = 810
    // leftover_w = 1890-1440 = 450 → cx = 450*0.5 = 225
    const r = computeContentRect(BOX_21_9, VIDEO_16_9, 'contain', CENTER);
    approx(r.cw, 1440);
    approx(r.ch, 810);
    approx(r.cx, 225);
    approx(r.cy, 0);
  });

  it('contain respects object-position (top-left)', () => {
    const r = computeContentRect(BOX_4_3, VIDEO_16_9, 'contain', { x: 0, y: 0 });
    approx(r.cx, 0);
    approx(r.cy, 0); // content pinned to top-left, bar at bottom
  });

  it('cover on 4:3 box (16:9 video) → crops top/bottom, fills width', () => {
    // scale = max(1200/1920, 900/1080) = max(0.625, 0.8333) = 0.8333
    // cw = 1920*0.8333 = 1600, ch = 1080*0.8333 = 900
    // overflow_w = 1600-1200 = 400 → cx = -400*0.5 = -200
    const r = computeContentRect(BOX_4_3, VIDEO_16_9, 'cover', CENTER);
    approx(r.cw, 1600);
    approx(r.ch, 900);
    approx(r.cx, -200);
    approx(r.cy, 0);
  });

  it('none → content at intrinsic size (may overflow box)', () => {
    // 1920×1080 in a 1200×900 box → overflows width, fits height.
    const r = computeContentRect(BOX_4_3, VIDEO_16_9, 'none', CENTER);
    expect(r.cw).toBe(1920);
    expect(r.ch).toBe(1080);
    approx(r.cx, (1200 - 1920) * 0.5); // -360
    approx(r.cy, (900 - 1080) * 0.5);  // -90
  });

  it('scale-down: intrinsic larger than box → behaves as contain', () => {
    const r = computeContentRect(BOX_4_3, VIDEO_16_9, 'scale-down', CENTER);
    const contain = computeContentRect(BOX_4_3, VIDEO_16_9, 'contain', CENTER);
    expect(r).toEqual(contain);
  });

  it('scale-down: intrinsic fits box → behaves as none', () => {
    const small: IntrinsicSize = { width: 600, height: 400 };
    const r = computeContentRect(BOX_4_3, small, 'scale-down', CENTER);
    const none = computeContentRect(BOX_4_3, small, 'none', CENTER);
    expect(r).toEqual(none);
  });

  it('degenerate: zero box or intrinsic → empty content rect', () => {
    expect(computeContentRect({ left: 0, top: 0, width: 0, height: 0 }, VIDEO_16_9, 'contain')).toEqual({ cx: 0, cy: 0, cw: 0, ch: 0 });
    expect(computeContentRect(BOX_4_3, { width: 0, height: 0 }, 'contain')).toEqual({ cx: 0, cy: 0, cw: 0, ch: 0 });
  });
});

describe('clampRegion', () => {
  it('clamps out-of-bounds x/y to [0,100]', () => {
    expect(clampRegion({ xPct: -10, yPct: 120, widthPct: 50, heightPct: 50 })).toEqual({ xPct: 0, yPct: 100, widthPct: 50, heightPct: 0 });
  });
  it('clamps width/height so x+width ≤ 100', () => {
    expect(clampRegion({ xPct: 80, yPct: 80, widthPct: 50, heightPct: 50 })).toEqual({ xPct: 80, yPct: 80, widthPct: 20, heightPct: 20 });
  });
  it('leaves a valid region untouched', () => {
    const r: CustomRegion = { xPct: 20, yPct: 30, widthPct: 40, heightPct: 50 };
    expect(clampRegion(r)).toEqual(r);
  });
});

// ─── Identity: shell = video box, object-fit fill → region unchanged ───
describe('identity (shell = video box, fill)', () => {
  const shell: PixelRect = { left: 100, top: 50, width: 1280, height: 720 };
  // video box == shell (same rect), object-fit fill → 1:1.
  const video: PixelRect = { left: 100, top: 50, width: 1280, height: 720 };

  it('a centered region maps to itself', () => {
    const r: CustomRegion = { xPct: 25, yPct: 25, widthPct: 50, heightPct: 50 };
    regionApprox(mapShellToIntrinsic(r, shell, video, VIDEO_16_9, 'fill'), r);
    regionApprox(mapIntrinsicToShell(r, shell, video, VIDEO_16_9, 'fill'), r);
  });

  it('the default bottom-15% region maps to itself', () => {
    const r: CustomRegion = { xPct: 0, yPct: 85, widthPct: 100, heightPct: 15 };
    regionApprox(mapShellToIntrinsic(r, shell, video, VIDEO_16_9, 'fill'), r);
  });
});

// ─── THE BUG: 16:9 video in a 4:3 container (pillarbox) ───
// Container 1200×900, video element fills it (inset:0), object-fit: contain.
// Video content is 1200×675 centered → 112.5px black bars top & bottom.
// A region drawn at the bottom of the CONTAINER (yPct=85) is NOT at the
// bottom of the VIDEO CONTENT — it sits partly in the bottom black bar.
describe('bug scenario A: 16:9 video in 4:3 container (pillarbox, contain)', () => {
  const shell: PixelRect = { left: 0, top: 0, width: 1200, height: 900 };
  const video: PixelRect = { left: 0, top: 0, width: 1200, height: 900 };

  it('container bottom-15% maps to a DIFFERENT intrinsic region (the bug)', () => {
    const containerBottom: CustomRegion = { xPct: 0, yPct: 85, widthPct: 100, heightPct: 15 };
    const intrinsic = mapShellToIntrinsic(containerBottom, shell, video, VIDEO_16_9, 'contain');
    // The container bottom 15% = y 765..900 in shell px. Video content spans
    // y 112.5..787.5 in box px. So 765..787.5 is in-content, 787.5..900 is bar.
    // Intrinsic y of 765px = (765-112.5)/675*1080 = 1044; of 787.5 = 1080.
    // The bar portion clamps to 1080 → intrinsic region y 1044..1080 = 3.33% h.
    approx(intrinsic.xPct, 0);
    approx(intrinsic.widthPct, 100);
    approx(intrinsic.yPct, (1044 / 1080) * 100, 1e-3);
    approx(intrinsic.heightPct, ((1080 - 1044) / 1080) * 100, 1e-3);
    // KEY: the naive (buggy) mapping would give yPct=85, heightPct=15 —
    // scanning intrinsic y 918..1080, MISSING the actual subtitle area which
    // (if drawn over the visible content bottom) is higher up.
    expect(intrinsic.yPct).toBeGreaterThan(85); // shifted down by the top bar
  });

  it('a region drawn over the visible content bottom maps to the true intrinsic bottom', () => {
    // Visible content bottom = box y 787.5 (= content top 112.5 + 675).
    // A 15%-of-content-height band above it: y 787.5-101.25 .. 787.5 = 686.25..787.5.
    // In shell % (shell height 900): yPct = 686.25/900*100 = 76.25, height = 101.25/900*100 = 11.25.
    const drawnOverContent: CustomRegion = { xPct: 0, yPct: 76.25, widthPct: 100, heightPct: 11.25 };
    const intrinsic = mapShellToIntrinsic(drawnOverContent, shell, video, VIDEO_16_9, 'contain');
    // This should map to intrinsic y 85..100 (the true bottom 15% of the video).
    approx(intrinsic.xPct, 0, 1e-3);
    approx(intrinsic.yPct, 85, 1e-3);
    approx(intrinsic.widthPct, 100, 1e-3);
    approx(intrinsic.heightPct, 15, 1e-3);
  });

  it('round-trip: shell→intrinsic→shell for an in-content region', () => {
    const inContent: CustomRegion = { xPct: 10, yPct: 20, widthPct: 60, heightPct: 40 };
    const intrinsic = mapShellToIntrinsic(inContent, shell, video, VIDEO_16_9, 'contain');
    const back = mapIntrinsicToShell(intrinsic, shell, video, VIDEO_16_9, 'contain');
    regionApprox(back, inContent, 1e-3);
  });
});

// ─── THE BUG: 16:9 video in a 21:9 container (letterbox, contain) ───
// Container 1890×810, video content 1440×810 centered → 225px bars left & right.
// This is the subtitle-bottom painpoint: vertical mapping is 1:1 (no top/bottom
// bar) but horizontal mapping shifts.
describe('bug scenario B: 16:9 video in 21:9 container (letterbox, contain)', () => {
  const shell: PixelRect = { left: 0, top: 0, width: 1890, height: 810 };
  const video: PixelRect = { left: 0, top: 0, width: 1890, height: 810 };

  it('container bottom-15% maps to correct intrinsic bottom (vertical 1:1, width scaled)', () => {
    const containerBottom: CustomRegion = { xPct: 0, yPct: 85, widthPct: 100, heightPct: 15 };
    const intrinsic = mapShellToIntrinsic(containerBottom, shell, video, VIDEO_16_9, 'contain');
    approx(intrinsic.yPct, 85, 1e-3);
    approx(intrinsic.heightPct, 15, 1e-3);
    // Width: shell 100% = 1890px → content cw=1440 → intrinsic width = 1890/1440*1920 = 2520 → clamped to 1920 (100%).
    approx(intrinsic.xPct, 0, 1e-3);
    approx(intrinsic.widthPct, 100, 1e-3);
  });

  it('a region over the right half of the CONTAINER spills into the right bar', () => {
    // Right bar starts at box x 1665 (= 225 + 1440). A region xPct=80..100 of
    // shell (1890) = x 1512..1890. 1512 is in-content, 1665..1890 is bar.
    const rightHalf: CustomRegion = { xPct: 80, yPct: 0, widthPct: 20, heightPct: 100 };
    const intrinsic = mapShellToIntrinsic(rightHalf, shell, video, VIDEO_16_9, 'contain');
    // Intrinsic x of 1512 = (1512-225)/1440*1920 = 1716; of 1665 = 1920; bar clamps.
    approx(intrinsic.xPct, (1716 / 1920) * 100, 1e-3);
    approx(intrinsic.widthPct, ((1920 - 1716) / 1920) * 100, 1e-3);
  });

  it('round-trip for an in-content region', () => {
    const inContent: CustomRegion = { xPct: 20, yPct: 70, widthPct: 50, heightPct: 20 };
    const intrinsic = mapShellToIntrinsic(inContent, shell, video, VIDEO_16_9, 'contain');
    const back = mapIntrinsicToShell(intrinsic, shell, video, VIDEO_16_9, 'contain');
    regionApprox(back, inContent, 1e-3);
  });
});

// ─── Video offset within shell (control bar / padding) ───
describe('video offset within shell', () => {
  // Shell 1280×760 (includes a 40px control bar at the bottom). Video element
  // is 1280×720 at the top of the shell. object-fit fill (video fills its box).
  const shell: PixelRect = { left: 0, top: 0, width: 1280, height: 760 };
  const video: PixelRect = { left: 0, top: 0, width: 1280, height: 720 };

  it('container bottom-15% (over the control bar) maps partly outside the video', () => {
    const containerBottom: CustomRegion = { xPct: 0, yPct: 85, widthPct: 100, heightPct: 15 };
    const intrinsic = mapShellToIntrinsic(containerBottom, shell, video, VIDEO_16_9, 'fill');
    // Shell y 646..760. Video box ends at 720. So 646..720 is in-video, 720..760 is bar.
    // Intrinsic y of 646 = 646/720*1080 = 969; of 720 = 1080; bar clamps.
    approx(intrinsic.yPct, (969 / 1080) * 100, 1e-3);
    approx(intrinsic.heightPct, ((1080 - 969) / 1080) * 100, 1e-3);
  });

  it('a region drawn over the video bottom (yPct 0..100 of the video area) maps to full intrinsic', () => {
    // Video occupies shell y 0..720 → yPct 0..94.74 of shell. Full video height.
    const fullVideo: CustomRegion = { xPct: 0, yPct: 0, widthPct: 100, heightPct: 720 / 760 * 100 };
    const intrinsic = mapShellToIntrinsic(fullVideo, shell, video, VIDEO_16_9, 'fill');
    approx(intrinsic.xPct, 0, 1e-3);
    approx(intrinsic.yPct, 0, 1e-3);
    approx(intrinsic.widthPct, 100, 1e-3);
    approx(intrinsic.heightPct, 100, 1e-3);
  });
});

// ─── object-fit: cover (content overflows, cropped) ───
describe('object-fit cover', () => {
  // 4:3 box, 16:9 video, cover: content 1600×900, cx=-200, cy=0.
  const shell: PixelRect = { left: 0, top: 0, width: 1200, height: 900 };
  const video: PixelRect = { left: 0, top: 0, width: 1200, height: 900 };

  it('full container maps to the visible (cropped) middle slice of intrinsic', () => {
    const full: CustomRegion = { xPct: 0, yPct: 0, widthPct: 100, heightPct: 100 };
    const intrinsic = mapShellToIntrinsic(full, shell, video, VIDEO_16_9, 'cover');
    // content cx=-200, cw=1600. Box x 0..1200 → content x -200..1000 →
    // intrinsic x (0-(-200))/1600*1920 .. (1200-(-200))/1600*1920 = 240..1680.
    // So the visible slice is the MIDDLE 75% (x 12.5%..87.5%), height full.
    approx(intrinsic.xPct, 12.5, 1e-3);
    approx(intrinsic.widthPct, 75, 1e-3);
    approx(intrinsic.yPct, 0, 1e-3);
    approx(intrinsic.heightPct, 100, 1e-3);
  });

  it('round-trip for an in-visible-slice region', () => {
    const inSlice: CustomRegion = { xPct: 10, yPct: 10, widthPct: 50, heightPct: 50 };
    const intrinsic = mapShellToIntrinsic(inSlice, shell, video, VIDEO_16_9, 'cover');
    const back = mapIntrinsicToShell(intrinsic, shell, video, VIDEO_16_9, 'cover');
    regionApprox(back, inSlice, 1e-3);
  });
});

// ─── object-fit: none (intrinsic size, may overflow) ───
describe('object-fit none', () => {
  const shell: PixelRect = { left: 0, top: 0, width: 1200, height: 900 };
  const video: PixelRect = { left: 0, top: 0, width: 1200, height: 900 };

  it('a region at box center maps to the intrinsic center', () => {
    // content 1920×1080, cx=-360, cy=-90. Box center (600,450) → content (960,540) → intrinsic center.
    const center: CustomRegion = { xPct: 50, yPct: 50, widthPct: 1, heightPct: 1 };
    const intrinsic = mapShellToIntrinsic(center, shell, video, VIDEO_16_9, 'none');
    approx(intrinsic.xPct, 50, 1e-3);
    approx(intrinsic.yPct, 50, 1e-3);
  });
});

// ─── Degenerate inputs ───
describe('degenerate inputs', () => {
  const shell: PixelRect = { left: 0, top: 0, width: 1280, height: 720 };
  const video: PixelRect = { left: 0, top: 0, width: 1280, height: 720 };
  const r: CustomRegion = { xPct: 50, yPct: 50, widthPct: 20, heightPct: 20 };

  it('zero intrinsic → empty region', () => {
    const zero: IntrinsicSize = { width: 0, height: 0 };
    expect(mapShellToIntrinsic(r, shell, video, zero, 'contain')).toEqual({ xPct: 0, yPct: 0, widthPct: 0, heightPct: 0 });
    expect(mapIntrinsicToShell(r, shell, video, zero, 'contain')).toEqual({ xPct: 0, yPct: 0, widthPct: 0, heightPct: 0 });
  });

  it('zero shell → empty region', () => {
    const zeroShell: PixelRect = { left: 0, top: 0, width: 0, height: 0 };
    expect(mapIntrinsicToShell(r, zeroShell, video, VIDEO_16_9, 'fill')).toEqual({ xPct: 0, yPct: 0, widthPct: 0, heightPct: 0 });
  });

  it('zero video box → empty content rect → empty region', () => {
    const zeroVideo: PixelRect = { left: 0, top: 0, width: 0, height: 0 };
    expect(mapShellToIntrinsic(r, shell, zeroVideo, VIDEO_16_9, 'contain')).toEqual({ xPct: 0, yPct: 0, widthPct: 0, heightPct: 0 });
  });
});

// ─── Edge: region at the very corners ───
describe('edge regions (0% and 100%)', () => {
  const shell: PixelRect = { left: 0, top: 0, width: 1280, height: 720 };
  const video: PixelRect = { left: 0, top: 0, width: 1280, height: 720 };

  it('top-left corner maps to intrinsic 0,0', () => {
    const tl: CustomRegion = { xPct: 0, yPct: 0, widthPct: 10, heightPct: 10 };
    regionApprox(mapShellToIntrinsic(tl, shell, video, VIDEO_16_9, 'fill'), tl);
  });

  it('full-frame region maps to 0,0,100,100', () => {
    const full: CustomRegion = { xPct: 0, yPct: 0, widthPct: 100, heightPct: 100 };
    regionApprox(mapShellToIntrinsic(full, shell, video, VIDEO_16_9, 'fill'), full);
  });
});

// ─── object-position effect on the bug scenario ───
describe('object-position shifts the content rect', () => {
  // 4:3 box, contain, 16:9 video. Default center → cy=112.5. Top → cy=0.
  const shell: PixelRect = { left: 0, top: 0, width: 1200, height: 900 };
  const video: PixelRect = { left: 0, top: 0, width: 1200, height: 900 };

  it('object-position top: content pinned to top, bottom bar at bottom', () => {
    const containerBottom: CustomRegion = { xPct: 0, yPct: 85, widthPct: 100, heightPct: 15 };
    const intrinsic = mapShellToIntrinsic(containerBottom, shell, video, VIDEO_16_9, 'contain', { x: 0.5, y: 0 });
    // content cy=0, ch=675. Shell y 765..900 → all in the bottom bar (content ends at 675).
    // So the whole region clamps to intrinsic y 100 → height 0.
    approx(intrinsic.yPct, 100, 1e-3);
    approx(intrinsic.heightPct, 0, 1e-3);
  });
});

// ─── Cross-check all 5 object-fit round-trip on the same in-content region ───
describe('round-trip across all object-fit values', () => {
  const shell: PixelRect = { left: 0, top: 0, width: 1280, height: 720 };
  const video: PixelRect = { left: 0, top: 0, width: 1280, height: 720 };
  // 16:9 box + 16:9 video → contain/cover/fill/none/scale-down all coincide
  // (no letterbox, content = box), so a centered region round-trips exactly.
  const fits: CustomRegion = { xPct: 25, yPct: 25, widthPct: 50, heightPct: 50 };
  const fits2: IntrinsicSize = { width: 1280, height: 720 };

  for (const fit of ['contain', 'fill', 'cover', 'none', 'scale-down'] as ObjectFit[]) {
    it(`${fit}: shell→intrinsic→shell is identity (matching aspect)`, () => {
      const intrinsic = mapShellToIntrinsic(fits, shell, video, fits2, fit);
      const back = mapIntrinsicToShell(intrinsic, shell, video, fits2, fit);
      regionApprox(back, fits, 1e-3);
    });
  }
});
