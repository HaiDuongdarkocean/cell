import { planParallelConversion } from '@/lib/converters/parallelPlanner';
import type { SegmentRange, Settings } from '@/types/media';
import {
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

function makeRanges(count: number, sizeEach: number): SegmentRange[] {
  const ranges: SegmentRange[] = [];
  let offset = 0;
  for (let i = 0; i < count; i++) {
    ranges.push({ index: i, startByte: offset, endByte: offset + sizeEach, size: sizeEach, duration: 10 });
    offset += sizeEach;
  }
  return ranges;
}

const LARGE_FILE = PARALLEL_LARGE_FILE_BYTES;
const EIGHT_CORES = 8;

describe('planParallelConversion', () => {
  it('returns disabled when policy is off', () => {
    const plan = planParallelConversion(
      makeSettings({ parallelConversion: 'off' }),
      makeRanges(12, 1000),
      LARGE_FILE,
      EIGHT_CORES,
    );
    expect(plan.shouldUseParallel).toBe(false);
    expect(plan.workerCount).toBe(0);
    expect(plan.summary).toContain('disabled');
  });

  it('returns disabled when file is too small', () => {
    const plan = planParallelConversion(
      makeSettings(),
      makeRanges(12, 1000),
      1000, // very small
      EIGHT_CORES,
    );
    expect(plan.shouldUseParallel).toBe(false);
    expect(plan.summary).toContain('disabled');
  });

  it('returns disabled when no segment metadata', () => {
    const plan = planParallelConversion(
      makeSettings(),
      undefined,
      LARGE_FILE,
      EIGHT_CORES,
    );
    expect(plan.shouldUseParallel).toBe(false);
    expect(plan.summary).toContain('safety rejected');
  });

  it('returns disabled when safety analysis fails', () => {
    const plan = planParallelConversion(
      makeSettings(),
      [], // empty ranges
      LARGE_FILE,
      EIGHT_CORES,
    );
    expect(plan.shouldUseParallel).toBe(false);
    expect(plan.summary).toContain('safety rejected');
  });

  it('returns enabled when both policy and safety pass', () => {
    const plan = planParallelConversion(
      makeSettings(),
      makeRanges(20, 20_000_000), // 400MB total
      LARGE_FILE,
      EIGHT_CORES,
    );
    expect(plan.shouldUseParallel).toBe(true);
    expect(plan.workerCount).toBe(4);
    expect(plan.summary).toContain('enabled');
    expect(plan.summary).toContain('4 workers');
  });

  it('uses lesser of policy and safety worker counts', () => {
    // Policy says 4 workers, but only 3 segments → safety caps at 3
    const plan = planParallelConversion(
      makeSettings(),
      makeRanges(3, 200_000_000), // 600MB, 3 segments
      LARGE_FILE,
      EIGHT_CORES,
    );
    expect(plan.shouldUseParallel).toBe(true);
    expect(plan.workerCount).toBe(3); // safety capped
  });

  it('includes both policy and safety in result', () => {
    const plan = planParallelConversion(
      makeSettings(),
      makeRanges(20, 20_000_000),
      LARGE_FILE,
      EIGHT_CORES,
    );
    expect(plan.policy.enabled).toBe(true);
    expect(plan.safety.eligible).toBe(true);
    expect(plan.safety.groups).toBeDefined();
  });

  it('summary is human-readable for disabled case', () => {
    const plan = planParallelConversion(
      makeSettings({ parallelConversion: 'off' }),
      makeRanges(20, 20_000_000),
      LARGE_FILE,
      EIGHT_CORES,
    );
    expect(plan.summary).toContain('[parallel-plan]');
    expect(plan.summary).toContain('disabled');
  });

  it('summary is human-readable for enabled case', () => {
    const plan = planParallelConversion(
      makeSettings({ parallelConversion: 'manual', manualWorkerCount: 3 }),
      makeRanges(20, 20_000_000),
      LARGE_FILE,
      EIGHT_CORES,
    );
    expect(plan.summary).toContain('[parallel-plan]');
    expect(plan.summary).toContain('enabled');
    expect(plan.summary).toContain('3 workers');
  });
});
