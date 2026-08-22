// regionMapping — map OCR region between coordinate spaces.
//
// ROOT CAUSE this module fixes: the region selector overlay attaches to the
// player shell (e.g. #movie_player) and captures drag % in SHELL space, but
// cropRegion applies those % to video.videoWidth/Height (INTRINSIC space).
// When the shell ≠ displayed video content (control-bar height, pillarbox,
// object-fit:contain letterbox) the scanned pixels do not match the drawn
// region — "OCR ở vùng này mà lại scan vùng khác".
//
// This module is the single source of truth for the shell↔intrinsic affine
// map. It accounts for: video element offset within shell, object-fit
// (contain/fill/cover/none/scale-down) letterboxing, and object-position.
// Algorithmic complexity: O(1) — a fixed affine transform, no loops.

import type { CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';

/** Rect in CSS pixels (page coords for *_rect helpers; box-relative for contentRect). */
export interface PixelRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Intrinsic video resolution (videoWidth × videoHeight). */
export interface IntrinsicSize {
  readonly width: number;
  readonly height: number;
}

/** object-position as fractions 0..1 (left→right, top→bottom). Default 0.5,0.5. */
export interface ObjectPosition {
  readonly x: number;
  readonly y: number;
}

/** Content rect = where the actual video pixels are drawn, in BOX-space CSS px
 *  (origin = video element's top-left). For cover/none this may overflow the
 *  box (cx/cy negative, cw/ch larger than the box). */
export interface ContentRect {
  readonly cx: number;
  readonly cy: number;
  readonly cw: number;
  readonly ch: number;
}

export type ObjectFit = 'contain' | 'fill' | 'cover' | 'none' | 'scale-down';

/** Parse a CSS object-position string into fractions 0..1.
 *  Accepts keywords (left/top/center/right/bottom) and percentages.
 *  One-value form: the missing axis defaults to center (0.5). */
export function parseObjectPosition(css: string): ObjectPosition {
  const tokens = css.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const keywordToFraction = (kw: string): number | null => {
    switch (kw) {
      case 'left': case 'top': return 0;
      case 'center': return 0.5;
      case 'right': case 'bottom': return 1;
      default: return null;
    }
  };
  const tokenToFraction = (tok: string): number => {
    const kw = keywordToFraction(tok);
    if (kw !== null) return kw;
    const pct = tok.endsWith('%') ? parseFloat(tok.slice(0, -1)) : parseFloat(tok);
    return Number.isFinite(pct) ? Math.max(0, Math.min(1, pct / 100)) : 0.5;
  };
  if (tokens.length === 0) return { x: 0.5, y: 0.5 };
  if (tokens.length === 1) {
    // A single horizontal keyword/% → x set, y = center. A single vertical
    // keyword (top/bottom) → y set, x = center.
    if (tokens[0] === 'top' || tokens[0] === 'bottom') return { x: 0.5, y: tokenToFraction(tokens[0]) };
    return { x: tokenToFraction(tokens[0]), y: 0.5 };
  }
  return { x: tokenToFraction(tokens[0]), y: tokenToFraction(tokens[1]) };
}

/** Compute the displayed video content rect inside the video element box,
 *  accounting for object-fit + object-position. Returns BOX-space CSS px
 *  (origin = video element top-left). O(1).
 *
 *  - fill: content stretched to box → contentRect = box.
 *  - contain: content scaled to fit (letterbox), positioned per object-position.
 *  - cover: content scaled to cover (overflow cropped), positioned per object-position.
 *  - none: content at intrinsic size, positioned per object-position (may overflow).
 *  - scale-down: min(none, contain) — none if intrinsic ≤ box, else contain. */
export function computeContentRect(
  box: PixelRect,
  intrinsic: IntrinsicSize,
  objectFit: ObjectFit,
  objectPosition: ObjectPosition = { x: 0.5, y: 0.5 },
): ContentRect {
  const { width: bw, height: bh } = box;
  const { width: iw, height: ih } = intrinsic;
  // Degenerate box or intrinsic → no content to map.
  if (bw <= 0 || bh <= 0 || iw <= 0 || ih <= 0) return { cx: 0, cy: 0, cw: 0, ch: 0 };

  const intrinsicAspect = iw / ih;
  const boxAspect = bw / bh;
  const px = objectPosition.x;
  const py = objectPosition.y;

  switch (objectFit) {
    case 'fill':
      return { cx: 0, cy: 0, cw: bw, ch: bh };

    case 'contain': {
      const scale = Math.min(bw / iw, bh / ih);
      const cw = iw * scale;
      const ch = ih * scale;
      return { cx: (bw - cw) * px, cy: (bh - ch) * py, cw, ch };
    }

    case 'cover': {
      const scale = Math.max(bw / iw, bh / ih);
      const cw = iw * scale;
      const ch = ih * scale;
      // Content overflows the box; cx/cy are the content's top-left, which
      // go negative so the visible slice is selected by object-position.
      return { cx: -(cw - bw) * px, cy: -(ch - bh) * py, cw, ch };
    }

    case 'none': {
      const cw = iw;
      const ch = ih;
      return { cx: (bw - cw) * px, cy: (bh - ch) * py, cw, ch };
    }

    case 'scale-down': {
      // Behaves as `none` when intrinsic fits the box, else `contain`.
      if (iw <= bw && ih <= bh) {
        return { cx: (bw - iw) * px, cy: (bh - ih) * py, cw: iw, ch: ih };
      }
      const scale = Math.min(bw / iw, bh / ih);
      const cw = iw * scale;
      const ch = ih * scale;
      return { cx: (bw - cw) * px, cy: (bh - ch) * py, cw, ch };
    }

    default: {
      // Unknown object-fit (e.g. browser-specific) → treat as fill (safest 1:1).
      void intrinsicAspect; void boxAspect;
      return { cx: 0, cy: 0, cw: bw, ch: bh };
    }
  }
}

/** Clamp a region to valid intrinsic bounds [0,100] with min size 1. */
export function clampRegion(region: CustomRegion): CustomRegion {
  const xPct = Math.max(0, Math.min(100, region.xPct));
  const yPct = Math.max(0, Math.min(100, region.yPct));
  const widthPct = Math.max(0, Math.min(100 - xPct, region.widthPct));
  const heightPct = Math.max(0, Math.min(100 - yPct, region.heightPct));
  return { xPct, yPct, widthPct, heightPct };
}

/** Map a SHELL-space region (%, relative to overlay container) to INTRINSIC-space
 *  region (%, relative to videoWidth/Height). O(1) affine transform.
 *
 *  @param shellRegion  Region in shell-space %.
 *  @param shellRect    Overlay container rect (page coords, CSS px).
 *  @param videoRect    Video element rect (page coords, CSS px).
 *  @param intrinsic    video.videoWidth/Height.
 *  @param objectFit    getComputedStyle(video).objectFit.
 *  @param objectPosition  parsed object-position fractions. */
export function mapShellToIntrinsic(
  shellRegion: CustomRegion,
  shellRect: PixelRect,
  videoRect: PixelRect,
  intrinsic: IntrinsicSize,
  objectFit: ObjectFit,
  objectPosition: ObjectPosition = { x: 0.5, y: 0.5 },
): CustomRegion {
  const content = computeContentRect(
    { left: 0, top: 0, width: videoRect.width, height: videoRect.height },
    intrinsic,
    objectFit,
    objectPosition,
  );
  if (content.cw <= 0 || content.ch <= 0 || intrinsic.width <= 0 || intrinsic.height <= 0) {
    return { xPct: 0, yPct: 0, widthPct: 0, heightPct: 0 };
  }

  // Video box offset within the shell (translation only — both are CSS px).
  const ox = videoRect.left - shellRect.left;
  const oy = videoRect.top - shellRect.top;

  // Corner: shell% → shell px → box px (subtract offset) → intrinsic px (object-fit) → intrinsic %.
  const shellXpx = (shellRegion.xPct / 100) * shellRect.width;
  const shellYpx = (shellRegion.yPct / 100) * shellRect.height;
  const boxXpx = shellXpx - ox;
  const boxYpx = shellYpx - oy;
  const intrinsicXpx = ((boxXpx - content.cx) / content.cw) * intrinsic.width;
  const intrinsicYpx = ((boxYpx - content.cy) / content.ch) * intrinsic.height;

  // Size: shell px extent → box px extent (translation-invariant) → intrinsic px (object-fit scale).
  const shellWpx = (shellRegion.widthPct / 100) * shellRect.width;
  const shellHpx = (shellRegion.heightPct / 100) * shellRect.height;
  const intrinsicWpx = (shellWpx / content.cw) * intrinsic.width;
  const intrinsicHpx = (shellHpx / content.ch) * intrinsic.height;

  return clampRegion({
    xPct: (intrinsicXpx / intrinsic.width) * 100,
    yPct: (intrinsicYpx / intrinsic.height) * 100,
    widthPct: (intrinsicWpx / intrinsic.width) * 100,
    heightPct: (intrinsicHpx / intrinsic.height) * 100,
  });
}

/** Map an INTRINSIC-space region (%, relative to videoWidth/Height) to SHELL-space
 *  region (%, relative to overlay container). Inverse of mapShellToIntrinsic. O(1). */
export function mapIntrinsicToShell(
  intrinsicRegion: CustomRegion,
  shellRect: PixelRect,
  videoRect: PixelRect,
  intrinsic: IntrinsicSize,
  objectFit: ObjectFit,
  objectPosition: ObjectPosition = { x: 0.5, y: 0.5 },
): CustomRegion {
  const content = computeContentRect(
    { left: 0, top: 0, width: videoRect.width, height: videoRect.height },
    intrinsic,
    objectFit,
    objectPosition,
  );
  if (content.cw <= 0 || content.ch <= 0 || shellRect.width <= 0 || shellRect.height <= 0) {
    return { xPct: 0, yPct: 0, widthPct: 0, heightPct: 0 };
  }

  const ox = videoRect.left - shellRect.left;
  const oy = videoRect.top - shellRect.top;

  // Corner: intrinsic % → intrinsic px → box px (object-fit) → shell px (add offset) → shell %.
  const intrinsicXpx = (intrinsicRegion.xPct / 100) * intrinsic.width;
  const intrinsicYpx = (intrinsicRegion.yPct / 100) * intrinsic.height;
  const boxXpx = content.cx + (intrinsicXpx / intrinsic.width) * content.cw;
  const boxYpx = content.cy + (intrinsicYpx / intrinsic.height) * content.ch;
  const shellXpx = boxXpx + ox;
  const shellYpx = boxYpx + oy;

  // Size: intrinsic px → box px (object-fit scale) → shell px (same unit) → shell %.
  const intrinsicWpx = (intrinsicRegion.widthPct / 100) * intrinsic.width;
  const intrinsicHpx = (intrinsicRegion.heightPct / 100) * intrinsic.height;
  const shellWpx = (intrinsicWpx / intrinsic.width) * content.cw;
  const shellHpx = (intrinsicHpx / intrinsic.height) * content.ch;

  return {
    xPct: (shellXpx / shellRect.width) * 100,
    yPct: (shellYpx / shellRect.height) * 100,
    widthPct: (shellWpx / shellRect.width) * 100,
    heightPct: (shellHpx / shellRect.height) * 100,
  };
}

/** Read live geometry from the DOM: shell + video rects, intrinsic size,
 *  object-fit + object-position. Thin reader — the pure math above is the
 *  testable core. Returns null when intrinsic isn't available yet. */
export function readVideoGeometry(
  video: HTMLVideoElement,
  shell: HTMLElement,
): {
  readonly shellRect: PixelRect;
  readonly videoRect: PixelRect;
  readonly intrinsic: IntrinsicSize;
  readonly objectFit: ObjectFit;
  readonly objectPosition: ObjectPosition;
} | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const shellRect = shell.getBoundingClientRect();
  const videoRect = video.getBoundingClientRect();
  if (shellRect.width <= 0 || shellRect.height <= 0) return null;
  const style = getComputedStyle(video);
  const objectFit = (style.objectFit as ObjectFit) ?? 'fill';
  const objectPosition = parseObjectPosition(style.objectPosition ?? '50% 50%');
  return {
    shellRect: { left: shellRect.left, top: shellRect.top, width: shellRect.width, height: shellRect.height },
    videoRect: { left: videoRect.left, top: videoRect.top, width: videoRect.width, height: videoRect.height },
    intrinsic: { width: video.videoWidth, height: video.videoHeight },
    objectFit,
    objectPosition,
  };
}
