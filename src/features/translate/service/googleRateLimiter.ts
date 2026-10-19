// Pacing queue for the Google translate gtx endpoint.
//
// The endpoint blocks an IP after bursts of ~50 req/min (429 "unusual
// traffic"). Every call goes through a serialized queue: max
// MAX_CALLS_PER_WINDOW per sliding window, minimum spacing between calls,
// and a cooldown after a 429. Queued calls wait for capacity instead of
// hammering — that is what keeps the block from ever triggering again.

const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 30;
const MIN_SPACING_MS = 1_200;
const COOLDOWN_ON_429_MS = 60_000;
/** Cooldown grows per consecutive 429 so a hard-blocked IP stops being hit. */
const MAX_COOLDOWN_MS = 10 * 60_000;

export interface PacedResult<T> {
  readonly status: number;
  readonly value: T | null;
}

export interface PaceTimings {
  readonly windowMs: number;
  readonly maxCalls: number;
  readonly spacingMs: number;
  readonly cooldownMs: number;
  readonly maxCooldownMs: number;
}

const DEFAULT_TIMINGS: PaceTimings = {
  windowMs: WINDOW_MS,
  maxCalls: MAX_CALLS_PER_WINDOW,
  spacingMs: MIN_SPACING_MS,
  cooldownMs: COOLDOWN_ON_429_MS,
  maxCooldownMs: MAX_COOLDOWN_MS,
};

let queue: Promise<unknown> = Promise.resolve();
let recentCalls: number[] = [];
let blockedUntil = 0;
let consecutiveBlocks = 0;

async function waitForCapacity(t: PaceTimings): Promise<void> {
  for (;;) {
    const now = Date.now();
    recentCalls = recentCalls.filter((x) => now - x < t.windowMs);
    let wait = blockedUntil - now;
    if (recentCalls.length >= t.maxCalls && recentCalls[0] !== undefined) {
      wait = Math.max(wait, t.windowMs - (now - recentCalls[0]));
    }
    const last = recentCalls[recentCalls.length - 1];
    if (last !== undefined) {
      wait = Math.max(wait, t.spacingMs - (now - last));
    }
    if (wait <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

export function googleTranslatePaced<T>(
  call: () => Promise<PacedResult<T>>,
  timings: PaceTimings = DEFAULT_TIMINGS,
): Promise<PacedResult<T>> {
  const run = async (): Promise<PacedResult<T>> => {
    await waitForCapacity(timings);
    recentCalls.push(Date.now());
    const result = await call();
    if (result.status === 429) {
      consecutiveBlocks += 1;
      blockedUntil =
        Date.now() + Math.min(timings.cooldownMs * consecutiveBlocks, timings.maxCooldownMs);
    } else {
      consecutiveBlocks = 0;
    }
    return result;
  };
  const task = queue.then(run);
  queue = task.catch(() => {});
  return task;
}
