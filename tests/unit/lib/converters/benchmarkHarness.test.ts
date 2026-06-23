import {
  runBenchmark,
  compareBenchmarks,
  formatBenchmarkResult,
  formatBenchmarkComparison,
  type BenchmarkResult,
} from '@/lib/converters/benchmarkHarness';

describe('benchmarkHarness', () => {
  describe('runBenchmark', () => {
    it('measures duration and throughput for successful conversion', async () => {
      const result = await runBenchmark(
        'sequential',
        1,
        10 * 1024 * 1024, // 10MB
        async () => ({ success: true }),
      );

      expect(result.mode).toBe('sequential');
      expect(result.workerCount).toBe(1);
      expect(result.inputBytes).toBe(10 * 1024 * 1024);
      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.throughputMBps).toBeGreaterThanOrEqual(0);
    });

    it('records failure and error message', async () => {
      const result = await runBenchmark(
        'parallel',
        4,
        100 * 1024 * 1024,
        async () => ({ success: false, error: 'transmux failed' }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('transmux failed');
    });

    it('catches thrown errors', async () => {
      const result = await runBenchmark(
        'parallel',
        2,
        50 * 1024 * 1024,
        async () => { throw new Error('crash'); },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('crash');
    });

    it('calculates throughput correctly', async () => {
      // Mock performance.now to return deterministic values
      const originalNow = performance.now;
      let time = 0;
      performance.now = jest.fn(() => time);
      time = 0;
      const promise = runBenchmark('sequential', 1, 100 * 1024 * 1024, async () => {
        time = 1000; // 1 second
        return { success: true };
      });
      const result = await promise;
      performance.now = originalNow;

      // 100MB in 1000ms = 100MB/s
      expect(result.throughputMBps).toBe(100);
    });
  });

  describe('compareBenchmarks', () => {
    function makeResult(mode: 'sequential' | 'parallel', durationMs: number, success = true): BenchmarkResult {
      return {
        mode,
        workerCount: mode === 'sequential' ? 1 : 4,
        inputBytes: 100 * 1024 * 1024,
        durationMs,
        throughputMBps: 100,
        success,
      };
    }

    it('returns parallel-faster when parallel is significantly faster', () => {
      const seq = makeResult('sequential', 10000);
      const par = makeResult('parallel', 4000);
      const comparison = compareBenchmarks(seq, par);

      expect(comparison.verdict).toBe('parallel-faster');
      expect(comparison.speedup).toBe(2.5);
    });

    it('returns sequential-faster when sequential is faster', () => {
      const seq = makeResult('sequential', 5000);
      const par = makeResult('parallel', 8000);
      const comparison = compareBenchmarks(seq, par);

      expect(comparison.verdict).toBe('sequential-faster');
    });

    it('returns inconclusive when times are similar', () => {
      const seq = makeResult('sequential', 5000);
      const par = makeResult('parallel', 5200);
      const comparison = compareBenchmarks(seq, par);

      expect(comparison.verdict).toBe('inconclusive');
    });

    it('returns inconclusive when either failed', () => {
      const seq = makeResult('sequential', 5000, false);
      const par = makeResult('parallel', 4000);
      const comparison = compareBenchmarks(seq, par);

      expect(comparison.verdict).toBe('inconclusive');
      expect(comparison.speedup).toBe(0);
    });
  });

  describe('formatBenchmarkResult', () => {
    it('formats successful result', () => {
      const result: BenchmarkResult = {
        mode: 'parallel',
        workerCount: 4,
        inputBytes: 424 * 1024 * 1024,
        durationMs: 12000,
        throughputMBps: 35.33,
        success: true,
      };
      const formatted = formatBenchmarkResult(result);
      expect(formatted).toContain('parallel');
      expect(formatted).toContain('4w');
      expect(formatted).toContain('OK');
      expect(formatted).toContain('424.0MB');
      expect(formatted).toContain('12000ms');
    });

    it('formats failed result with error', () => {
      const result: BenchmarkResult = {
        mode: 'sequential',
        workerCount: 1,
        inputBytes: 100 * 1024 * 1024,
        durationMs: 5000,
        throughputMBps: 20,
        success: false,
        error: 'timeout',
      };
      const formatted = formatBenchmarkResult(result);
      expect(formatted).toContain('FAIL');
      expect(formatted).toContain('timeout');
    });
  });

  describe('formatBenchmarkComparison', () => {
    it('formats comparison with speedup', () => {
      const comparison = compareBenchmarks(
        { mode: 'sequential', workerCount: 1, inputBytes: 100e6, durationMs: 10000, throughputMBps: 10, success: true },
        { mode: 'parallel', workerCount: 4, inputBytes: 100e6, durationMs: 4000, throughputMBps: 25, success: true },
      );
      const formatted = formatBenchmarkComparison(comparison);
      expect(formatted).toContain('parallel-faster');
      expect(formatted).toContain('2.5x speedup');
      expect(formatted).toContain('10000ms');
      expect(formatted).toContain('4000ms');
    });
  });
});
