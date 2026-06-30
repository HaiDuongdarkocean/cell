import {
  DownloadQueue,
  type DownloadExecutor,
} from '@/features/download/downloadQueue';
import type { DownloadItem, DownloadProgress } from '@/types/media';
import {
  DEFAULT_CONCURRENT_DOWNLOADS,
  MAX_CONCURRENT_DOWNLOADS,
  MIN_CONCURRENT_DOWNLOADS,
} from '@/shared/config/config';

function makeItem(id: string, title = `item-${id}`): DownloadItem {
  return {
    id,
    mediaType: 'video',
    url: `https://example.com/${id}.mp4`,
    title,
    tabId: 1,
    status: 'queued',
    progress: 0,
  };
}

/**
 * Creates a controllable mock executor. Each call returns a promise that is
 * only resolved/rejected when the test explicitly triggers it, allowing us to
 * keep downloads "in flight" while inspecting queue state.
 */
function createControllableExecutor() {
  const resolvers: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  const calls: DownloadItem[] = [];

  const executor: DownloadExecutor = (item) => {
    calls.push(item);
    return new Promise<void>((resolve, reject) => {
      resolvers.push({ resolve, reject });
    });
  };

  /** Resolve the oldest in-flight download. */
  function resolveNext(): void {
    const r = resolvers.shift();
    if (r) r.resolve();
  }

  /** Reject the oldest in-flight download. */
  function rejectNext(err: Error): void {
    const r = resolvers.shift();
    if (r) r.reject(err);
  }

  return { executor, calls, resolveNext, rejectNext, inFlight: () => resolvers.length };
}

describe('DownloadQueue', () => {
  let queue: DownloadQueue;

  beforeEach(() => {
    queue = new DownloadQueue();
  });

  afterEach(() => {
    queue = undefined as unknown as DownloadQueue;
  });

  it('add() adds an item with status "queued"', () => {
    const item = makeItem('1');
    queue.add(item);

    const stored = queue.getById('1');
    expect(stored).toBeDefined();
    expect(stored?.status).toBe('queued');
    expect(queue.getAll()).toHaveLength(1);
  });

  it('processNext() starts a download when an executor is set', () => {
    const { executor, calls } = createControllableExecutor();
    queue.setExecutor(executor);

    queue.add(makeItem('1'));
    // processNext is invoked internally by add(); the executor should be called.
    expect(calls).toHaveLength(1);
    expect(queue.getById('1')?.status).toBe('downloading');
  });

  it('respects the concurrent limit: only maxConcurrent items are active at once', () => {
    const { executor, calls } = createControllableExecutor();
    queue.setExecutor(executor);

    // Default maxConcurrent = 3
    queue.addAll([makeItem('1'), makeItem('2'), makeItem('3'), makeItem('4'), makeItem('5')]);

    expect(calls).toHaveLength(DEFAULT_CONCURRENT_DOWNLOADS);
    const downloading = queue.getAll().filter((i) => i.status === 'downloading');
    expect(downloading).toHaveLength(DEFAULT_CONCURRENT_DOWNLOADS);
    const queued = queue.getAll().filter((i) => i.status === 'queued');
    expect(queued).toHaveLength(2);
  });

  it('starts the next queued item when one download completes', async () => {
    const { executor, calls, resolveNext } = createControllableExecutor();
    queue.setExecutor(executor);

    queue.addAll([makeItem('1'), makeItem('2'), makeItem('3'), makeItem('4')]);
    expect(calls).toHaveLength(3);

    // Complete the first in-flight download.
    resolveNext();
    // Allow microtasks (promise resolution) to flush.
    await Promise.resolve();
    await Promise.resolve();

    expect(queue.getById('1')?.status).toBe('done');
    // The 4th item should now have started.
    expect(calls).toHaveLength(4);
    expect(queue.getById('4')?.status).toBe('downloading');
  });

  it('sets status to "error" when the executor rejects', async () => {
    const { executor, rejectNext } = createControllableExecutor();
    queue.setExecutor(executor);

    queue.add(makeItem('1'));
    rejectNext(new Error('network failure'));
    await Promise.resolve();
    await Promise.resolve();

    const stored = queue.getById('1');
    expect(stored?.status).toBe('error');
    expect(stored?.error).toBe('network failure');
  });

  it('cancel() sets status to "cancelled"', () => {
    const { executor } = createControllableExecutor();
    queue.setExecutor(executor);

    queue.add(makeItem('1'));
    expect(queue.getById('1')?.status).toBe('downloading');

    queue.cancel('1');
    expect(queue.getById('1')?.status).toBe('cancelled');
  });

  it('pause() sets status to "paused" and resume() sets it back to "queued"', async () => {
    const { executor, calls, resolveNext } = createControllableExecutor();
    queue.setExecutor(executor);

    // Use an item that is still queued (not yet started) to test pause/resume.
    queue.addAll([makeItem('1'), makeItem('2'), makeItem('3'), makeItem('4')]);
    const target = queue.getById('4');
    expect(target?.status).toBe('queued');

    queue.pause('4');
    expect(queue.getById('4')?.status).toBe('paused');

    queue.resume('4');
    expect(queue.getById('4')?.status).toBe('queued');

    // Free up a slot so the resumed item can start.
    resolveNext();
    // Allow the executor's .then handler (which calls processNext) to flush.
    await Promise.resolve();
    await Promise.resolve();
    // resume() calls processNext internally; the item should now be picked up.
    expect(calls).toContainEqual(expect.objectContaining({ id: '4' }));
  });

  it('addAll() adds multiple items to the queue', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')];
    queue.addAll(items);

    expect(queue.getAll()).toHaveLength(3);
    expect(queue.getById('a')).toBeDefined();
    expect(queue.getById('b')).toBeDefined();
    expect(queue.getById('c')).toBeDefined();
  });

  it('onProgress() callback is invoked when updateProgress() is called', () => {
    const received: DownloadProgress[] = [];
    const unsubscribe = queue.onProgress((p) => received.push(p));

    queue.add(makeItem('1'));
    const progress: DownloadProgress = {
      itemId: '1',
      status: 'downloading',
      progress: 42,
      currentSegment: 5,
      totalSegments: 10,
    };
    queue.updateProgress(progress);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(progress);
    expect(queue.getById('1')?.progress).toBe(42);
    expect(queue.getById('1')?.status).toBe('downloading');

    unsubscribe();
    queue.updateProgress({ itemId: '1', status: 'downloading', progress: 50 });
    expect(received).toHaveLength(1);
  });

  it('setMaxConcurrent() clamps between MIN and MAX', () => {
    queue.setMaxConcurrent(0);
    expect(queue.getMaxConcurrent()).toBe(MIN_CONCURRENT_DOWNLOADS);

    queue.setMaxConcurrent(MAX_CONCURRENT_DOWNLOADS + 100);
    expect(queue.getMaxConcurrent()).toBe(MAX_CONCURRENT_DOWNLOADS);

    queue.setMaxConcurrent(5);
    expect(queue.getMaxConcurrent()).toBe(5);
  });

  it('getAll() returns all items and getById() returns a specific item', () => {
    queue.addAll([makeItem('x'), makeItem('y'), makeItem('z')]);
    expect(queue.getAll()).toHaveLength(3);

    const y = queue.getById('y');
    expect(y?.id).toBe('y');
    expect(queue.getById('nope')).toBeUndefined();
  });

  it('getByTab() returns only items for the specified tab', () => {
    const tab1Item = { ...makeItem('a'), tabId: 10 };
    const tab2Item = { ...makeItem('b'), tabId: 20 };
    const tab1Item2 = { ...makeItem('c'), tabId: 10 };
    queue.addAll([tab1Item, tab2Item, tab1Item2]);

    expect(queue.getByTab(10)).toHaveLength(2);
    expect(queue.getByTab(10).map((i) => i.id)).toEqual(['a', 'c']);
    expect(queue.getByTab(20)).toHaveLength(1);
    expect(queue.getByTab(999)).toHaveLength(0);
  });

  it('removeByTab() removes all items for the specified tab and leaves others', () => {
    const tab1Item = { ...makeItem('a'), tabId: 10 };
    const tab2Item = { ...makeItem('b'), tabId: 20 };
    const tab1Item2 = { ...makeItem('c'), tabId: 10 };
    queue.addAll([tab1Item, tab2Item, tab1Item2]);

    queue.removeByTab(10);

    expect(queue.getAll()).toHaveLength(1);
    expect(queue.getAll()[0].id).toBe('b');
  });

  it('uses the default concurrent value when none is provided', () => {
    expect(queue.getMaxConcurrent()).toBe(DEFAULT_CONCURRENT_DOWNLOADS);
  });

  it('setMaxConcurrent() triggers processing of queued items when capacity increases', () => {
    const { executor, calls } = createControllableExecutor();
    queue.setExecutor(executor);

    // Start with capacity 1.
    queue.setMaxConcurrent(1);
    queue.addAll([makeItem('1'), makeItem('2'), makeItem('3')]);
    expect(calls).toHaveLength(1);

    // Increase capacity; processNext should pick up more items.
    queue.setMaxConcurrent(3);
    expect(calls).toHaveLength(3);
  });

  // === retry() tests ===

  it('retry() resets an errored item to queued', () => {
    queue.add(makeItem('err1'));
    // Simulate error via updateProgress
    queue.updateProgress({
      itemId: 'err1',
      status: 'error',
      progress: 50,
      error: 'Network timeout',
    });
    expect(queue.getById('err1')?.status).toBe('error');
    expect(queue.getById('err1')?.error).toBe('Network timeout');

    queue.retry('err1');
    const item = queue.getById('err1');
    expect(item?.status).toBe('queued');
    expect(item?.progress).toBe(0);
    expect(item?.error).toBeUndefined();
  });

  it('retry() resets downloadProgress and convertProgress', () => {
    queue.add(makeItem('err2'));
    queue.updateProgress({
      itemId: 'err2',
      status: 'error',
      progress: 75,
      downloadProgress: 100,
      convertProgress: 50,
      error: 'Conversion failed',
    });
    queue.retry('err2');
    const item = queue.getById('err2');
    expect(item?.downloadProgress).toBeUndefined();
    expect(item?.convertProgress).toBeUndefined();
  });

  it('retry() is no-op on a non-error item', () => {
    queue.add(makeItem('ok1'));
    queue.updateProgress({ itemId: 'ok1', status: 'downloading', progress: 30 });
    queue.retry('ok1');
    expect(queue.getById('ok1')?.status).toBe('downloading');
    expect(queue.getById('ok1')?.progress).toBe(30);
  });

  it('retry() is no-op on non-existent item', () => {
    queue.retry('nonexistent');
    // Should not throw
    expect(queue.getAll()).toHaveLength(0);
  });

  it('retry() works on cancelled items too', () => {
    queue.add(makeItem('can1'));
    queue.cancel('can1');
    expect(queue.getById('can1')?.status).toBe('cancelled');
    queue.retry('can1');
    expect(queue.getById('can1')?.status).toBe('queued');
  });

  // === remove() tests ===

  it('remove() deletes an item from the queue', () => {
    queue.add(makeItem('rm1'));
    expect(queue.getById('rm1')).toBeDefined();
    queue.remove('rm1');
    expect(queue.getById('rm1')).toBeUndefined();
  });

  it('remove() is no-op on non-existent item', () => {
    queue.remove('nonexistent');
    // Should not throw
  });

  it('remove() does not affect other items', () => {
    queue.add(makeItem('keep'));
    queue.add(makeItem('remove'));
    queue.remove('remove');
    expect(queue.getById('keep')).toBeDefined();
    expect(queue.getById('remove')).toBeUndefined();
  });
});
