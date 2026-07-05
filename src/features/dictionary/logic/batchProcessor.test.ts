import { BatchProcessor, BATCH_SIZE } from '@/features/dictionary/logic/batchProcessor';

describe('batchProcessor', () => {
  it('BATCH_SIZE is 5000', () => {
    expect(BATCH_SIZE).toBe(5000);
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

  it('calls onProgress after each flush', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const onProgress = jest.fn();
    const bp = new BatchProcessor<number>(flush, onProgress);
    for (let i = 0; i < BATCH_SIZE; i++) await bp.add(i);
    expect(onProgress).toHaveBeenCalledWith(BATCH_SIZE);
    for (let i = 0; i < 500; i++) await bp.add(i);
    await bp.flush();
    expect(onProgress).toHaveBeenLastCalledWith(BATCH_SIZE + 500);
  });

  it('handles multiple flushes correctly', async () => {
    const flush = jest.fn().mockResolvedValue(undefined);
    const bp = new BatchProcessor<number>(flush);
    for (let i = 0; i < BATCH_SIZE * 2 + 100; i++) await bp.add(i);
    await bp.flush();
    expect(flush).toHaveBeenCalledTimes(3);
    expect(bp.count).toBe(BATCH_SIZE * 2 + 100);
  });
});
