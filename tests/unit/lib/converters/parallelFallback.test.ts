import { decideFallback, executeWithFallback } from '@/lib/converters/parallelFallback';

describe('decideFallback', () => {
  describe('fail strategy', () => {
    it('returns fail action', () => {
      const result = decideFallback('fail', 4, 1, 'transmux error');
      expect(result.action).toBe('fail');
      expect(result.reason).toContain('fail strategy');
    });

    it('returns fail action even on retry attempt', () => {
      const result = decideFallback('fail', 2, 2, 'still failing');
      expect(result.action).toBe('fail');
    });
  });

  describe('sequential strategy', () => {
    it('returns sequential action on first failure', () => {
      const result = decideFallback('sequential', 4, 1, 'error');
      expect(result.action).toBe('sequential');
      expect(result.reason).toContain('sequential fallback');
    });

    it('returns sequential action on retry failure', () => {
      const result = decideFallback('sequential', 2, 2, 'error');
      expect(result.action).toBe('sequential');
    });
  });

  describe('retry-reduced strategy', () => {
    it('returns retry-reduced on first attempt with fewer workers', () => {
      const result = decideFallback('retry-reduced', 4, 1, 'error');
      expect(result.action).toBe('retry-reduced');
      expect(result.retryWorkerCount).toBe(2);
      expect(result.reason).toContain('retry with 2 workers');
    });

    it('returns sequential on second attempt', () => {
      const result = decideFallback('retry-reduced', 2, 2, 'error');
      expect(result.action).toBe('sequential');
      expect(result.reason).toContain('after retry');
    });

    it('returns sequential when cannot reduce below min', () => {
      const result = decideFallback('retry-reduced', 2, 1, 'error', 2);
      // 2/2 = 1, but min is 2, so reducedWorkers = max(2, 1) = 2
      // 2 < 2 is false, so no retry → sequential
      expect(result.action).toBe('sequential');
    });

    it('reduces to minimum when current is just above min', () => {
      const result = decideFallback('retry-reduced', 3, 1, 'error', 2);
      // 3/2 = 1, max(2, 1) = 2, 2 < 3 → retry with 2
      expect(result.action).toBe('retry-reduced');
      expect(result.retryWorkerCount).toBe(2);
    });
  });

  describe('unknown strategy', () => {
    it('falls back to sequential', () => {
      const result = decideFallback('unknown' as never, 4, 1, 'error');
      expect(result.action).toBe('sequential');
      expect(result.reason).toContain('unknown strategy');
    });
  });
});

describe('executeWithFallback', () => {
  it('returns parallel result on success', async () => {
    const parallelFn = jest.fn().mockResolvedValue('parallel-result');
    const sequentialFn = jest.fn().mockResolvedValue('sequential-result');

    const result = await executeWithFallback(parallelFn, sequentialFn, 'sequential', 4);

    expect(result).toBe('parallel-result');
    expect(parallelFn).toHaveBeenCalledTimes(1);
    expect(sequentialFn).not.toHaveBeenCalled();
  });

  it('falls back to sequential on failure with sequential strategy', async () => {
    const parallelFn = jest.fn().mockRejectedValue(new Error('parallel failed'));
    const sequentialFn = jest.fn().mockResolvedValue('sequential-result');

    const result = await executeWithFallback(parallelFn, sequentialFn, 'sequential', 4);

    expect(result).toBe('sequential-result');
    expect(parallelFn).toHaveBeenCalledTimes(1);
    expect(sequentialFn).toHaveBeenCalledTimes(1);
  });

  it('retries with reduced workers then falls back to sequential', async () => {
    const parallelFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('attempt 1 failed'))
      .mockRejectedValueOnce(new Error('attempt 2 failed'));
    const sequentialFn = jest.fn().mockResolvedValue('sequential-result');

    const result = await executeWithFallback(parallelFn, sequentialFn, 'retry-reduced', 4);

    expect(result).toBe('sequential-result');
    expect(parallelFn).toHaveBeenCalledTimes(2);
    expect(parallelFn).toHaveBeenNthCalledWith(1, 4);
    expect(parallelFn).toHaveBeenNthCalledWith(2, 2);
    expect(sequentialFn).toHaveBeenCalledTimes(1);
  });

  it('succeeds on retry with reduced workers', async () => {
    const parallelFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('attempt 1 failed'))
      .mockResolvedValueOnce('retry-result');
    const sequentialFn = jest.fn();

    const result = await executeWithFallback(parallelFn, sequentialFn, 'retry-reduced', 4);

    expect(result).toBe('retry-result');
    expect(parallelFn).toHaveBeenCalledTimes(2);
    expect(sequentialFn).not.toHaveBeenCalled();
  });

  it('throws on fail strategy', async () => {
    const parallelFn = jest.fn().mockRejectedValue(new Error('parallel failed'));
    const sequentialFn = jest.fn();

    await expect(
      executeWithFallback(parallelFn, sequentialFn, 'fail', 4),
    ).rejects.toThrow('parallel failed');

    expect(sequentialFn).not.toHaveBeenCalled();
  });
});
