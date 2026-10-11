// yieldToEventLoop — cooperative yield inside long synchronous loops so the
// service worker stays responsive to messages during import.
// scheduler.yield() (Chrome 129+) keeps task priority; setTimeout fallback
// covers Firefox and older Chromium forks.

interface SchedulerLike {
  yield?: () => Promise<void>;
}

export function yieldToEventLoop(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: SchedulerLike }).scheduler;
  return typeof scheduler?.yield === 'function'
    ? scheduler.yield()
    : new Promise((resolve) => setTimeout(resolve, 0));
}

const YIELD_BUDGET_MS = 40;
const YIELD_EVERY_ENTRIES = 4000;

/** Bound synchronous bursts to ~YIELD_BUDGET_MS; the count floor keeps
 *  degenerate fast iterations cooperative when the clock barely moves. */
export function createYieldChecker(): () => Promise<void> {
  let deadline = performance.now() + YIELD_BUDGET_MS;
  let count = 0;
  return async () => {
    if (++count < YIELD_EVERY_ENTRIES && performance.now() < deadline) return;
    count = 0;
    deadline = performance.now() + YIELD_BUDGET_MS;
    await yieldToEventLoop();
  };
}
