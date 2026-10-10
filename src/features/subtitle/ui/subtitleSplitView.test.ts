import { splitViewSheetHeightPx } from '../logic/playerModeGeometry';

describe('splitViewSheetHeightPx', () => {
  it('falls back to 50vh capped at 460 when no user height is stored', () => {
    expect(splitViewSheetHeightPx(null, 800)).toBe(400);
    expect(splitViewSheetHeightPx(null, 1200)).toBe(460);
  });

  it('converts a stored viewport % to px', () => {
    expect(splitViewSheetHeightPx(70, 800)).toBe(560);
  });

  it('floors at the minimum usable height', () => {
    expect(splitViewSheetHeightPx(10, 800)).toBe(200);
  });

  it('caps at the viewport minus the edge margin', () => {
    expect(splitViewSheetHeightPx(100, 800)).toBe(792);
  });
});
