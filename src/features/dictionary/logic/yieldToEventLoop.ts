// yieldToEventLoop — cooperative yield inside long synchronous loops so the
// service worker stays responsive to messages during import.
// scheduler.yield() (Chrome 129+) keeps task priority; setTimeout fallback
// covers Firefox and older Chromium forks.

interface SchedulerLike {
  yield?: () => Promise<void>;
}

export function yieldToEventLoop(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: SchedulerLike }).scheduler;
  return scheduler?.yield !== undefined
    ? scheduler.yield()
    : new Promise((resolve) => setTimeout(resolve, 0));
}
