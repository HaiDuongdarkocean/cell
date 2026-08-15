import { updateStableCount, SETTLE_FRAMES, SETTLE_MAX_WAIT_MS } from './waitForPlayerSettle';

describe('updateStableCount', () => {
  it('increments when dims unchanged', () => {
    expect(updateStableCount(100, 200, 100, 200, 0)).toBe(1);
    expect(updateStableCount(100, 200, 100, 200, 1)).toBe(2);
  });

  it('resets to 0 when width changes', () => {
    expect(updateStableCount(100, 200, 101, 200, 1)).toBe(0);
  });

  it('resets to 0 when height changes', () => {
    expect(updateStableCount(100, 200, 100, 201, 1)).toBe(0);
  });

  it('resets to 0 when both change', () => {
    expect(updateStableCount(100, 200, 90, 180, 1)).toBe(0);
  });

  it('resets to 0 on first check (prev=-1 sentinel vs real dims)', () => {
    expect(updateStableCount(-1, -1, 100, 200, 0)).toBe(0);
  });
});

describe('constants', () => {
  it('SETTLE_FRAMES is 2', () => {
    expect(SETTLE_FRAMES).toBe(2);
  });

  it('SETTLE_MAX_WAIT_MS is 2000', () => {
    expect(SETTLE_MAX_WAIT_MS).toBe(2000);
  });
});
