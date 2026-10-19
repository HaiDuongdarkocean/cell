import { googleTranslatePaced, type PacedResult, type PaceTimings } from './googleRateLimiter';

const TIMINGS: PaceTimings = {
  windowMs: 100,
  maxCalls: 2,
  spacingMs: 10,
  cooldownMs: 60,
  maxCooldownMs: 200,
};

describe('googleTranslatePaced', () => {
  it('serializes calls and spaces them by spacingMs', async () => {
    const calls: number[] = [];
    const call = (): Promise<PacedResult<string>> => {
      calls.push(Date.now());
      return Promise.resolve({ status: 200, value: 'ok' });
    };
    await Promise.all([
      googleTranslatePaced(call, TIMINGS),
      googleTranslatePaced(call, TIMINGS),
      googleTranslatePaced(call, TIMINGS),
    ]);
    expect(calls).toHaveLength(3);
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]! - calls[i - 1]!).toBeGreaterThanOrEqual(5);
    }
  });

  it('cools down after a 429 and blocks the next call until it ends', async () => {
    const calls: number[] = [];
    const call = (): Promise<PacedResult<string>> => {
      calls.push(Date.now());
      return Promise.resolve({ status: 429, value: null });
    };
    await googleTranslatePaced(call, TIMINGS);
    const started = Date.now();
    await googleTranslatePaced(call, TIMINGS);
    expect(calls).toHaveLength(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
  });
});
