// splitRegion — chia parent region thành 2 nửa top/bottom (spec ocr-split-dual-stream).
import type { CustomRegion } from '@/features/ocr/persistence/ocrStateTypes';

export interface SplitHalf {
  readonly xPct: number;
  readonly yPct: number;
  readonly widthPct: number;
  readonly heightPct: number;
}

/** First-enable: default bottom 15% chia đôi = 7.5%/stream quá thấp → bump lên 40% (spec user story 9). */
export const SPLIT_DEFAULT_REGION_PCT = 40;

export function computeSplitHalves(
  parent: CustomRegion,
  ratio: number,
): { top: SplitHalf; bottom: SplitHalf } {
  const r = Math.max(0.1, Math.min(0.9, ratio));
  const splitY = parent.yPct + parent.heightPct * r;
  return {
    top: { xPct: parent.xPct, yPct: parent.yPct, widthPct: parent.widthPct, heightPct: parent.heightPct * r },
    bottom: { xPct: parent.xPct, yPct: splitY, widthPct: parent.widthPct, heightPct: parent.heightPct * (1 - r) },
  };
}
