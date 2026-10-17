import { describe, expect, it } from '@jest/globals';
import { serialQueue, sleep } from './async';

describe('sleep', () => {
  it('resolves after the delay', async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});

describe('serialQueue', () => {
  it('runs tasks sequentially', async () => {
    const run = serialQueue();
    const order: number[] = [];
    const task = (id: number, delay: number) => () =>
      sleep(delay).then(() => {
        order.push(id);
        return id;
      });
    const [a, b, c] = await Promise.all([run(task(1, 30)), run(task(2, 10)), run(task(3, 0))]);
    expect([a, b, c]).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('survives task rejection — the queue is not poisoned', async () => {
    const run = serialQueue();
    const failing = run(() => Promise.reject(new Error('boom')));
    const next = run(() => Promise.resolve('ok'));
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('propagates each task value to its own caller', async () => {
    const run = serialQueue();
    await expect(run(() => Promise.resolve(42))).resolves.toBe(42);
  });
});
