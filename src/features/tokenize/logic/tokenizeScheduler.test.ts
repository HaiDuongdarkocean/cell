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
});
