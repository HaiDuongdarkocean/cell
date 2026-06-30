import { resolveParallelPolicy } from '@/lib/converters/parallelPolicy';
import type { Settings } from '@/types/media';
import {
  MIN_PARALLEL_WORKERS,
  MAX_PARALLEL_WORKERS,
  PARALLEL_MIN_FILE_BYTES,
  PARALLEL_LARGE_FILE_BYTES,
} from '@/shared/config/config';

function makeSettings(
  overrides: Partial<Pick<Settings, 'parallelConversion' | 'manualWorkerCount'>> = {},
): Pick<Settings, 'parallelConversion' | 'manualWorkerCount'> {
  return {
    parallelConversion: 'auto',
    manualWorkerCount: 4,
    ...overrides,
  };
}

const LARGE_FILE = PARALLEL_LARGE_FILE_BYTES; // 300MB
const MEDIUM_FILE = PARALLEL_MIN_FILE_BYTES + 10 * 1024 * 1024; // 160MB
const SMALL_FILE = PARALLEL_MIN_FILE_BYTES - 1; // just under threshold
const EIGHT_CORES = 8;

describe('resolveParallelPolicy', () => {
  describe('mode: off', () => {
    it('always returns disabled when mode is off', () => {
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'off' }),
        LARGE_FILE,
        EIGHT_CORES,
      );
      expect(result.enabled).toBe(false);
      expect(result.workerCount).toBe(0);
      expect(result.reason).toContain('off');
    });

    it('returns disabled even for large files on many cores', () => {
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'off' }),
        500 * 1024 * 1024,
        16,
      );
      expect(result.enabled).toBe(false);
    });
  });

  describe('file size thresholds', () => {
    it('returns disabled for files below PARALLEL_MIN_FILE_BYTES', () => {
      const result = resolveParallelPolicy(
        makeSettings(),
        SMALL_FILE,
        EIGHT_CORES,
      );
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('threshold');
    });

    it('returns enabled for files at PARALLEL_MIN_FILE_BYTES', () => {
      const result = resolveParallelPolicy(
        makeSettings(),
        PARALLEL_MIN_FILE_BYTES,
        EIGHT_CORES,
      );
      expect(result.enabled).toBe(true);
    });
  });

  describe('hardware concurrency', () => {
    it('returns disabled when hardwareConcurrency < 3', () => {
      const result = resolveParallelPolicy(
        makeSettings(),
        LARGE_FILE,
        2,
      );
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('concurrency');
    });

    it('returns disabled when hardwareConcurrency is undefined', () => {
      const result = resolveParallelPolicy(
        makeSettings(),
        LARGE_FILE,
        undefined,
      );
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('concurrency');
    });

    it('returns enabled with 3 cores (minimum)', () => {
      const result = resolveParallelPolicy(
        makeSettings(),
        LARGE_FILE,
        3,
      );
      expect(result.enabled).toBe(true);
      // 3 cores → max 2 workers (3-1)
      expect(result.workerCount).toBe(2);
    });
  });

  describe('auto mode', () => {
    it('selects 2 workers for medium files', () => {
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'auto' }),
        MEDIUM_FILE,
        EIGHT_CORES,
      );
      expect(result.enabled).toBe(true);
      expect(result.workerCount).toBe(2);
    });

    it('selects 4 workers for large files', () => {
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'auto' }),
        LARGE_FILE,
        EIGHT_CORES,
      );
      expect(result.enabled).toBe(true);
      expect(result.workerCount).toBe(4);
    });

    it('clamps to hardware-1 on low core counts', () => {
      // 4 cores → max 3 workers, but auto large requests 4
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'auto' }),
        LARGE_FILE,
        4,
      );
      expect(result.enabled).toBe(true);
      expect(result.workerCount).toBe(3);
    });
  });

  describe('manual mode', () => {
    it('uses requested worker count', () => {
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'manual', manualWorkerCount: 3 }),
        LARGE_FILE,
        EIGHT_CORES,
      );
      expect(result.enabled).toBe(true);
      expect(result.workerCount).toBe(3);
    });

    it('clamps to MAX_PARALLEL_WORKERS', () => {
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'manual', manualWorkerCount: 99 }),
        LARGE_FILE,
        EIGHT_CORES,
      );
      expect(result.enabled).toBe(true);
      expect(result.workerCount).toBe(MAX_PARALLEL_WORKERS);
    });

    it('clamps to MIN_PARALLEL_WORKERS', () => {
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'manual', manualWorkerCount: 0 }),
        LARGE_FILE,
        EIGHT_CORES,
      );
      expect(result.enabled).toBe(true);
      expect(result.workerCount).toBe(MIN_PARALLEL_WORKERS);
    });

    it('clamps to hardware-1', () => {
      // 5 cores → max 4 workers, manual requests 6
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'manual', manualWorkerCount: 6 }),
        LARGE_FILE,
        5,
      );
      expect(result.enabled).toBe(true);
      expect(result.workerCount).toBe(4);
    });
  });

  describe('active worker budget', () => {
    it('returns disabled when budget is exhausted', () => {
      const result = resolveParallelPolicy(
        makeSettings(),
        LARGE_FILE,
        EIGHT_CORES,
        MAX_PARALLEL_WORKERS, // all budget used
      );
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('budget');
    });

    it('reduces worker count based on active budget', () => {
      // 8 cores, auto large → 4 workers, but 2 already active → 4 available, but 4 requested
      // Actually: MAX_PARALLEL_WORKERS=6, active=2, available=4, requested=4 → 4
      const result = resolveParallelPolicy(
        makeSettings(),
        LARGE_FILE,
        EIGHT_CORES,
        2,
      );
      expect(result.enabled).toBe(true);
      expect(result.workerCount).toBe(4);
    });

    it('returns disabled when available budget < MIN_PARALLEL_WORKERS', () => {
      // MAX=6, active=5, available=1 < MIN=2
      const result = resolveParallelPolicy(
        makeSettings(),
        LARGE_FILE,
        EIGHT_CORES,
        5,
      );
      expect(result.enabled).toBe(false);
      expect(result.reason).toContain('budget');
    });
  });

  describe('result shape', () => {
    it('includes mode in result', () => {
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'manual' }),
        LARGE_FILE,
        EIGHT_CORES,
      );
      expect(result.mode).toBe('manual');
    });

    it('includes human-readable reason', () => {
      const result = resolveParallelPolicy(
        makeSettings({ parallelConversion: 'auto' }),
        LARGE_FILE,
        EIGHT_CORES,
      );
      expect(result.reason).toContain('auto');
      expect(result.reason).toContain('workers');
      expect(result.reason).toContain('cores');
    });
  });
});
