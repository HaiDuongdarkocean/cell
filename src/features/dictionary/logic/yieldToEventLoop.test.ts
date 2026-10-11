import { createYieldChecker } from './yieldToEventLoop';

const originalScheduler = (globalThis as { scheduler?: unknown }).scheduler;

beforeEach(() => {
  Object.defineProperty(globalThis, 'scheduler', { value: undefined, configurable: true });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  Object.defineProperty(globalThis, 'scheduler', { value: originalScheduler, configurable: true });
});

async function isImmediate(p: Promise<void>): Promise<boolean> {
  let done = false;
  void p.then(() => { done = true; });
  await Promise.resolve();
  await Promise.resolve();
  return done;
}

describe('createYieldChecker', () => {
  it('skips the yield while inside the time budget', async () => {
    const now = jest.spyOn(performance, 'now').mockReturnValue(1000);
    const maybeYield = createYieldChecker();
    expect(await isImmediate(maybeYield())).toBe(true);
    now.mockReturnValue(1039);
    expect(await isImmediate(maybeYield())).toBe(true);
  });

  it('yields once the time budget is exceeded and resets the deadline', async () => {
    const now = jest.spyOn(performance, 'now').mockReturnValue(1000);
    const maybeYield = createYieldChecker();
    now.mockReturnValue(1040);
    const pending = maybeYield();
    expect(await isImmediate(pending)).toBe(false);
    await jest.advanceTimersByTimeAsync(0);
    await pending;
    now.mockReturnValue(1079);
    expect(await isImmediate(maybeYield())).toBe(true);
    now.mockReturnValue(1080);
    const second = maybeYield();
    expect(await isImmediate(second)).toBe(false);
    await jest.advanceTimersByTimeAsync(0);
    await second;
  });

  it('still yields at the entry floor when the clock never reaches the budget', async () => {
    jest.spyOn(performance, 'now').mockReturnValue(1000);
    const maybeYield = createYieldChecker();
    for (let i = 0; i < 3999; i++) {
      expect(await isImmediate(maybeYield())).toBe(true);
    }
    const pending = maybeYield();
    expect(await isImmediate(pending)).toBe(false);
    await jest.advanceTimersByTimeAsync(0);
    await pending;
    expect(await isImmediate(maybeYield())).toBe(true);
  });
});
