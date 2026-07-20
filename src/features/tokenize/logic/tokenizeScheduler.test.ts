import { describe, expect, it } from '@jest/globals';
import { TokenizeScheduler, PRIORITY_VIEWPORT, PRIORITY_BUFFER, PRIORITY_IDLE } from './tokenizeScheduler';

describe('TokenizeScheduler', () => {
  it('runs tasks in priority order', async () => {
    const scheduler = new TokenizeScheduler();
    const order: number[] = [];
    scheduler.schedule(() => { order.push(PRIORITY_IDLE); }, PRIORITY_IDLE);
    scheduler.schedule(() => { order.push(PRIORITY_VIEWPORT); }, PRIORITY_VIEWPORT);
    scheduler.schedule(() => { order.push(PRIORITY_BUFFER); }, PRIORITY_BUFFER);
    await scheduler.flush();
    expect(order).toEqual([PRIORITY_VIEWPORT, PRIORITY_BUFFER, PRIORITY_IDLE]);
  });

  it('awaits async tasks', async () => {
    const scheduler = new TokenizeScheduler();
    const order: string[] = [];
    scheduler.schedule(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push('async');
    }, PRIORITY_VIEWPORT);
    scheduler.schedule(() => { order.push('sync'); }, PRIORITY_BUFFER);
    await scheduler.flush();
    expect(order).toEqual(['async', 'sync']);
  });

  it('cancel removes a pending task', async () => {
    const scheduler = new TokenizeScheduler();
    const order: string[] = [];
    const cancel = scheduler.schedule(() => { order.push('removed'); }, PRIORITY_VIEWPORT);
    scheduler.schedule(() => { order.push('kept'); }, PRIORITY_IDLE);
    cancel();
    await scheduler.flush();
    expect(order).toEqual(['kept']);
  });

  it('runs viewport-priority tasks without waiting for requestIdleCallback', async () => {
    // Simulate a busy browser: requestIdleCallback is installed but never fires
    // (as happens during fast scrolling). Viewport tasks must still run via the
    // setTimeout(0) fast path; idle-priority tasks must NOT run.
    const idleCallbacks: Array<() => void> = [];
    const originalRIC = (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback;
    const originalCIC = (globalThis as { cancelIdleCallback?: unknown }).cancelIdleCallback;
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = (cb: () => void) => {
      idleCallbacks.push(cb);
      return 0;
    };
    (globalThis as { cancelIdleCallback?: unknown }).cancelIdleCallback = () => { /* no-op */ };

    try {
      const scheduler = new TokenizeScheduler();
      const order: string[] = [];
      scheduler.schedule(() => { order.push('viewport'); }, PRIORITY_VIEWPORT);
      scheduler.schedule(() => { order.push('idle'); }, PRIORITY_IDLE);

      // Wait long enough for setTimeout(0) to fire. Idle callback never fires.
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(order).toContain('viewport');
      expect(order).not.toContain('idle');
      scheduler.stop();
    } finally {
      (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = originalRIC;
      (globalThis as { cancelIdleCallback?: unknown }).cancelIdleCallback = originalCIC;
    }
  });
});
