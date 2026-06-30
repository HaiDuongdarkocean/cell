import {
  evaluateGates,
  resolveEffectiveMode,
  recordBenchmark,
  recordAttempt,
  DEFAULT_GATE_STATE,
  type GateState,
} from '@/features/transmux/execution/autoEnablement';
import type { BenchmarkComparison } from '@/features/transmux/execution/benchmarkHarness';

function makeComparison(
  verdict: 'parallel-faster' | 'sequential-faster' | 'inconclusive',
  speedup: number,
): BenchmarkComparison {
  return {
    sequential: {
      mode: 'sequential',
      workerCount: 1,
      inputBytes: 100e6,
      durationMs: 10000,
      throughputMBps: 10,
      success: true,
    },
    parallel: {
      mode: 'parallel',
      workerCount: 4,
      inputBytes: 100e6,
      durationMs: Math.round(10000 / speedup),
      throughputMBps: 10 * speedup,
      success: true,
    },
    speedup,
    verdict,
  };
}

describe('autoEnablement', () => {
  describe('evaluateGates', () => {
    it('fails with no benchmark data', () => {
      const result = evaluateGates(DEFAULT_GATE_STATE);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('0 benchmarks');
    });

    it('fails when no benchmark shows parallel faster', () => {
      const state: GateState = {
        ...DEFAULT_GATE_STATE,
        benchmarks: [makeComparison('sequential-faster', 0.5)],
      };
      const result = evaluateGates(state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('no benchmark showed parallel faster');
    });

    it('fails when speedup is below threshold', () => {
      const state: GateState = {
        ...DEFAULT_GATE_STATE,
        benchmarks: [makeComparison('parallel-faster', 1.05)],
      };
      const result = evaluateGates(state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('no benchmark showed parallel faster');
    });

    it('passes when benchmark shows parallel faster with good speedup', () => {
      const state: GateState = {
        ...DEFAULT_GATE_STATE,
        benchmarks: [makeComparison('parallel-faster', 2.0)],
      };
      const result = evaluateGates(state);
      expect(result.passed).toBe(true);
    });

    it('fails when failure rate is too high', () => {
      const state: GateState = {
        ...DEFAULT_GATE_STATE,
        benchmarks: [makeComparison('parallel-faster', 2.0)],
        totalAttempts: 10,
        totalFailures: 5, // 50% failure rate
      };
      const result = evaluateGates(state);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('failure rate');
    });

    it('passes with zero attempts (no failure data yet)', () => {
      const state: GateState = {
        ...DEFAULT_GATE_STATE,
        benchmarks: [makeComparison('parallel-faster', 2.0)],
        totalAttempts: 0,
        totalFailures: 0,
      };
      const result = evaluateGates(state);
      expect(result.passed).toBe(true);
    });

    it('passes with acceptable failure rate', () => {
      const state: GateState = {
        ...DEFAULT_GATE_STATE,
        benchmarks: [makeComparison('parallel-faster', 2.0)],
        totalAttempts: 10,
        totalFailures: 1, // 10% failure rate
      };
      const result = evaluateGates(state);
      expect(result.passed).toBe(true);
    });
  });

  describe('resolveEffectiveMode', () => {
    it('respects explicit off mode', () => {
      const result = resolveEffectiveMode('off', DEFAULT_GATE_STATE);
      expect(result).toBe('off');
    });

    it('respects explicit manual mode', () => {
      const result = resolveEffectiveMode('manual', DEFAULT_GATE_STATE);
      expect(result).toBe('manual');
    });

    it('falls back to off when auto mode but gates not passed', () => {
      const result = resolveEffectiveMode('auto', DEFAULT_GATE_STATE);
      expect(result).toBe('off');
    });

    it('returns auto when gates have passed', () => {
      const state: GateState = {
        ...DEFAULT_GATE_STATE,
        benchmarks: [makeComparison('parallel-faster', 2.0)],
        autoEnabled: true,
      };
      const result = resolveEffectiveMode('auto', state);
      expect(result).toBe('auto');
    });

    it('returns off for unknown mode', () => {
      const result = resolveEffectiveMode('unknown' as never, DEFAULT_GATE_STATE);
      expect(result).toBe('off');
    });
  });

  describe('recordBenchmark', () => {
    it('adds benchmark to state', () => {
      const comparison = makeComparison('parallel-faster', 2.0);
      const newState = recordBenchmark(DEFAULT_GATE_STATE, comparison);
      expect(newState.benchmarks).toHaveLength(1);
      expect(newState.benchmarks[0]).toBe(comparison);
    });

    it('keeps only last 10 benchmarks', () => {
      let state = DEFAULT_GATE_STATE;
      for (let i = 0; i < 15; i++) {
        state = recordBenchmark(state, makeComparison('parallel-faster', 2.0));
      }
      expect(state.benchmarks).toHaveLength(10);
    });

    it('does not mutate original state', () => {
      const original = DEFAULT_GATE_STATE;
      const newState = recordBenchmark(original, makeComparison('parallel-faster', 2.0));
      expect(original.benchmarks).toHaveLength(0);
      expect(newState.benchmarks).toHaveLength(1);
    });
  });

  describe('recordAttempt', () => {
    it('increments total attempts', () => {
      const newState = recordAttempt(DEFAULT_GATE_STATE, true);
      expect(newState.totalAttempts).toBe(1);
      expect(newState.totalFailures).toBe(0);
    });

    it('increments failures on failure', () => {
      const newState = recordAttempt(DEFAULT_GATE_STATE, false);
      expect(newState.totalAttempts).toBe(1);
      expect(newState.totalFailures).toBe(1);
    });

    it('does not mutate original state', () => {
      const original = DEFAULT_GATE_STATE;
      recordAttempt(original, true);
      expect(original.totalAttempts).toBe(0);
    });
  });
});
