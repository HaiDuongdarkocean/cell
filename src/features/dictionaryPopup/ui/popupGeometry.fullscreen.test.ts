import { describe, expect, it } from '@jest/globals';
import { computePopupPosition, POPUP_MARGIN_PX, POPUP_POINTER_GAP_PX } from './popupGeometry';

describe('computePopupPosition — fullscreen subtitle case', () => {
  // Reproduces actual inputs from browser debug:
  // anchor = word "viewers" rect, lineRect = subtitle line band
  // vw=2560, vh=1440, popupWidth=560, popupHeight=480
  const anchor = { top: 1063, left: 1172, right: 1253, bottom: 1099 };
  const lineRect = { top: 1063, left: 1066, right: 1172, bottom: 1095 };
  const vw = 2560;
  const vh = 1440;
  const popupWidth = 560;
  const popupHeight = 480;

  it('NE corner (right+above) fits without clamping and should win', () => {
    // NE raw: left=1257, top=579 — fits (1257+560=1817<2560, 579>8, 579+480=1059<1440)
    const pos = computePopupPosition(
      anchor.top, anchor.left, anchor.right, anchor.bottom,
      popupWidth, vw, vh, popupHeight,
      undefined, lineRect,
    );
    // NE should win: clears word diagonally, fits viewport, no clamp penalty
    expect(pos.left).toBe(anchor.right + POPUP_POINTER_GAP_PX); // 1257
    expect(pos.top).toBe(anchor.top - POPUP_POINTER_GAP_PX - popupHeight); // 579
  });

  it('with pointer hint (click point 1209,1079) — still NE or recognizable corner', () => {
    // Browser dispatch: pointer = {x: 1209, y: 1079}
    const pointer = { tip: { x: 1209, y: 1079 } };
    const pos = computePopupPosition(
      anchor.top, anchor.left, anchor.right, anchor.bottom,
      popupWidth, vw, vh, popupHeight,
      pointer, lineRect,
    );
    const seLeft = anchor.right + POPUP_POINTER_GAP_PX;
    const swLeft = anchor.left - popupWidth - POPUP_POINTER_GAP_PX;
    const neLeft = anchor.right + POPUP_POINTER_GAP_PX;
    const nwLeft = anchor.left - popupWidth - POPUP_POINTER_GAP_PX;
    const belowTop = Math.max(anchor.bottom, lineRect.bottom) + POPUP_POINTER_GAP_PX;
    const aboveTop = Math.min(anchor.top, lineRect.top) - POPUP_POINTER_GAP_PX - popupHeight;
    const clampedBelowTop = vh - popupHeight - POPUP_MARGIN_PX;
    const clampedSwLeft = Math.max(POPUP_MARGIN_PX, swLeft);
    const clampedNwLeft = Math.max(POPUP_MARGIN_PX, nwLeft);

    const isSE = pos.left === seLeft && (pos.top === belowTop || pos.top === clampedBelowTop);
    const isSW = pos.left === (swLeft < POPUP_MARGIN_PX ? clampedSwLeft : swLeft) && (pos.top === belowTop || pos.top === clampedBelowTop);
    const isNE = pos.left === neLeft && pos.top === aboveTop;
    const isNW = pos.left === (nwLeft < POPUP_MARGIN_PX ? clampedNwLeft : nwLeft) && pos.top === aboveTop;

    expect([isSE, isSW, isNE, isNW].some(Boolean)).toBe(true);
  });

  it('SE corner clamps top (popup too tall for below) but keeps right', () => {
    // SE raw: left=1257, top=1103 — 1103+480=1583 > 1440 → clamp top=952
    const pos = computePopupPosition(
      anchor.top, anchor.left, anchor.right, anchor.bottom,
      popupWidth, vw, vh, popupHeight,
      undefined, lineRect,
    );
    // SE should NOT win because NE fits without clamping
    expect(pos.top).not.toBe(vh - popupHeight - POPUP_MARGIN_PX); // not clamped 952
  });

  it('ignores a zero-size line rect after highlight DOM mutation', () => {
    const word = { top: 1036, left: 747, right: 818, bottom: 1061 };
    const zeroLine = { top: 0, left: 0, right: 0, bottom: 0 };
    const pos = computePopupPosition(
      word.top, word.left, word.right, word.bottom,
      popupWidth, 1406, 1179, popupHeight,
      { tip: { x: 782, y: 1048 } }, zeroLine,
    );

    expect([552, 1065]).toContain(pos.top);
  });

  it('anchors to the clicked word, not the bounding box of its paragraph', () => {
    const word = { top: 1036, left: 747, right: 818, bottom: 1061 };
    const paragraphBounds = { top: 977, left: 323, right: 1081, bottom: 1092 };
    const pos = computePopupPosition(
      word.top, word.left, word.right, word.bottom,
      popupWidth, 1406, 1179, popupHeight,
      { tip: { x: 782, y: 1048 } }, paragraphBounds,
    );

    // The popup may use any valid word corner, but its top must be based on
    // the clicked word's line, never on paragraphBounds.top (977).
    const wordCornerTops = [
      word.bottom + POPUP_POINTER_GAP_PX,
      word.top - POPUP_POINTER_GAP_PX - popupHeight,
    ];
    expect(wordCornerTops).toContain(pos.top);
  });

  it('result must match a recognizable corner (SE/SW/NE/NW), not arbitrary (608,730)', () => {
    const pos = computePopupPosition(
      anchor.top, anchor.left, anchor.right, anchor.bottom,
      popupWidth, vw, vh, popupHeight,
      undefined, lineRect,
    );
    const seLeft = anchor.right + POPUP_POINTER_GAP_PX;
    const swLeft = anchor.left - popupWidth - POPUP_POINTER_GAP_PX;
    const neLeft = anchor.right + POPUP_POINTER_GAP_PX;
    const nwLeft = anchor.left - popupWidth - POPUP_POINTER_GAP_PX;
    const belowTop = Math.max(anchor.bottom, lineRect.bottom) + POPUP_POINTER_GAP_PX;
    const aboveTop = Math.min(anchor.top, lineRect.top) - POPUP_POINTER_GAP_PX - popupHeight;
    const clampedBelowTop = vh - popupHeight - POPUP_MARGIN_PX;
    const clampedSwLeft = Math.max(POPUP_MARGIN_PX, swLeft);
    const clampedNwLeft = Math.max(POPUP_MARGIN_PX, nwLeft);

    const isSE = pos.left === seLeft && (pos.top === belowTop || pos.top === clampedBelowTop);
    const isSW = pos.left === (swLeft < POPUP_MARGIN_PX ? clampedSwLeft : swLeft) && (pos.top === belowTop || pos.top === clampedBelowTop);
    const isNE = pos.left === neLeft && pos.top === aboveTop;
    const isNW = pos.left === (nwLeft < POPUP_MARGIN_PX ? clampedNwLeft : nwLeft) && pos.top === aboveTop;

    expect([isSE, isSW, isNE, isNW].some(Boolean)).toBe(true);
  });
});
