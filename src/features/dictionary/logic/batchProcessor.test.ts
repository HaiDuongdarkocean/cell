import 'fake-indexeddb/auto';
import { BatchProcessor, BATCH_SIZE } from '@/features/dictionary/logic/batchProcessor';

describe('batchProcessor', () => {
  it('BATCH_SIZE is 2000', () => {
    expect(BATCH_SIZE).toBe(2000);
  });

  it('accumulates without flushing below BATCH_SIZE', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const bp = new BatchProcessor<number>(flush);
    for (let i = 0; i < 100; i++) await bp.add(i);
    expect(flush).not.toHaveBeenCalled();
    expect(bp.pending).toBe(100);
    expect(bp.count).toBe(0);
  });

  it('auto-flushes when buffer reaches BATCH_SIZE', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const bp = new BatchProcessor<number>(flush);
    for (let i = 0; i < BATCH_SIZE; i++) await bp.add(i);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith(expect.any(Array));
    expect(flush.mock.calls[0]![0]).toHaveLength(BATCH_SIZE);
    expect(bp.count).toBe(BATCH_SIZE);
    expect(bp.pending).toBe(0);
  });

  it('flush() flushes remaining buffer', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const bp = new BatchProcessor<number>(flush);
    for (let i = 0; i < 150; i++) await bp.add(i);
    await bp.flush();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0]![0]).toHaveLength(150);
    expect(bp.count).toBe(150);
  });

  it('flush() on empty buffer is no-op', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const bp = new BatchProcessor<number>(flush);
    await bp.flush();
    expect(flush).not.toHaveBeenCalled();
  });

  it('calls onProgress after each flush with processed + total', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const onProgress = jest.fn();
    const bp = new BatchProcessor<number>(flush, onProgress);
    bp.setTotal(6000);
    for (let i = 0; i < BATCH_SIZE; i++) await bp.add(i);
    expect(onProgress).toHaveBeenCalledWith(BATCH_SIZE, 6000);
    for (let i = 0; i < 500; i++) await bp.add(i);
    await bp.flush();
    expect(onProgress).toHaveBeenLastCalledWith(BATCH_SIZE + 500, 6000);
  });

  it('reports 0 total until setTotal is called', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const onProgress = jest.fn();
    const bp = new BatchProcessor<number>(flush, onProgress);
    await bp.add(1);
    await bp.flush();
    expect(onProgress).toHaveBeenCalledWith(1, 0);
  });

  it('handles multiple flushes correctly', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const bp = new BatchProcessor<number>(flush);
    for (let i = 0; i < BATCH_SIZE * 2 + 100; i++) await bp.add(i);
    await bp.flush();
    expect(flush).toHaveBeenCalledTimes(3);
    expect(bp.count).toBe(BATCH_SIZE * 2 + 100);
  });

  it('keeps the next batch accumulating while a flush is in flight', async () => {
    let resolveFirst: (() => void) | undefined;
    const flush = jest
      .fn<Promise<void>, [ReadonlyArray<number>]>()
      .mockImplementationOnce(() => new Promise<void>((r) => { resolveFirst = r; }))
      .mockResolvedValue(undefined);
    const bp = new BatchProcessor<number>(flush);
    for (let i = 0; i < BATCH_SIZE; i++) await bp.add(i);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0]![0]).toHaveLength(BATCH_SIZE);
    const tail: Promise<void>[] = [];
    for (let i = 0; i < BATCH_SIZE; i++) tail.push(bp.add(i));
    await Promise.resolve();
    expect(bp.pending).toBe(BATCH_SIZE);
    expect(flush).toHaveBeenCalledTimes(1);
    resolveFirst!();
    await Promise.all(tail);
    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush.mock.calls[1]![0]).toHaveLength(BATCH_SIZE);
    await bp.flush();
    expect(bp.count).toBe(BATCH_SIZE * 2);
  });

  it('creates the next write transaction only after the in-flight write commits', async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('batch-processor-ordering', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('entries'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const events: string[] = [];
    let batchNo = 0;
    const flush = (batch: ReadonlyArray<number>): Promise<void> => {
      const n = ++batchNo;
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('entries', 'readwrite');
        events.push(`tx-create-${n}`);
        tx.objectStore('entries').put(batch.length, `batch-${n}`);
        tx.oncomplete = () => { events.push(`tx-complete-${n}`); resolve(); };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    };
    const bp = new BatchProcessor<number>(flush);
    for (let i = 0; i < BATCH_SIZE * 2; i++) await bp.add(i);
    await bp.flush();
    db.close();
    expect(events.indexOf('tx-complete-1')).toBeGreaterThan(-1);
    expect(events.indexOf('tx-create-2')).toBeGreaterThan(events.indexOf('tx-complete-1'));
  });

  it('propagates a rejected in-flight flush on the next add and on flush', async () => {
    const flush = jest
      .fn<Promise<void>, [ReadonlyArray<number>]>()
      .mockRejectedValueOnce(new Error('IDB full'))
      .mockResolvedValue(undefined);
    const bp = new BatchProcessor<number>(flush);
    const run = async (): Promise<void> => {
      for (let i = 0; i < BATCH_SIZE * 2; i++) await bp.add(i);
    };
    await expect(run()).rejects.toThrow('IDB full');
    await expect(bp.flush()).rejects.toThrow('IDB full');
  });
});
