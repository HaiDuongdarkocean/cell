/**
 * Auto-enablement gates for parallel conversion.
 *
 * Parallel conversion is NOT enabled by default until benchmark
 * data proves it is faster than sequential for the user's hardware.
 *
 * Gates that must pass before auto mode is enabled:
 * 1. At least one benchmark comparison collected
 * 2. Parallel was faster (speedup > 1.1x) in the benchmark
 * 3. No parallel conversion failures in recent history
 *
 * If gates pass, the default `parallelConversion` setting changes
 * from 'off' to 'auto'. If gates fail, it stays 'off'.
 */

import type { ParallelConversionMode } from '@/types/media';
import type { BenchmarkComparison } from '@/lib/converters/benchmarkHarness';

/** Minimum speedup required to enable auto mode (1.1x = 10% faster). */
const MIN_SPEEDUP_FOR_AUTO = 1.1;

/** Minimum number of benchmark comparisons required. */
const MIN_BENCHMARKS_REQUIRED = 1;

/** Maximum failure rate allowed (0.0 = no failures, 1.0 = all failures). */
const MAX_FAILURE_RATE = 0.2;

/**
 * Persistent gate state stored in chrome.storage.local.
 */
export interface GateState {
  /** Benchmark comparisons collected so far. */
  readonly benchmarks: BenchmarkComparison[];
  /** Number of parallel conversion attempts. */
  readonly totalAttempts: number;
  /** Number of parallel conversion failures. */
  readonly totalFailures: number;
  /** Whether auto mode has been explicitly enabled. */
  readonly autoEnabled: boolean;
}

/** Default gate state (no data, auto disabled). */
export const DEFAULT_GATE_STATE: GateState = {
  benchmarks: [],
  totalAttempts: 0,
  totalFailures: 0,
  autoEnabled: false,
};

/**
 * Evaluate whether the auto-enablement gates have passed.
 *
 * @param state - Current gate state.
 * @returns Whether auto mode should be enabled.
 */
export function evaluateGates(state: GateState): {
  passed: boolean;
  reason: string;
} {
  // Gate 1: Enough benchmark data
  if (state.benchmarks.length < MIN_BENCHMARKS_REQUIRED) {
    return {
      passed: false,
      reason: `only ${state.benchmarks.length} benchmarks, need ${MIN_BENCHMARKS_REQUIRED}`,
    };
  }

  // Gate 2: Parallel was faster in at least one benchmark
  const hasFasterBenchmark = state.benchmarks.some(
    (b) => b.verdict === 'parallel-faster' && b.speedup >= MIN_SPEEDUP_FOR_AUTO,
  );
  if (!hasFasterBenchmark) {
    return {
      passed: false,
      reason: 'no benchmark showed parallel faster than sequential',
    };
  }

  // Gate 3: Failure rate is acceptable
  if (state.totalAttempts > 0) {
    const failureRate = state.totalFailures / state.totalAttempts;
    if (failureRate > MAX_FAILURE_RATE) {
      return {
        passed: false,
        reason: `failure rate ${(failureRate * 100).toFixed(0)}% exceeds ${MAX_FAILURE_RATE * 100}% threshold`,
      };
    }
  }

  return {
    passed: true,
    reason: `gates passed: ${state.benchmarks.length} benchmarks, parallel faster, failure rate acceptable`,
  };
}

/**
 * Determine the effective parallel conversion mode.
 *
 * If the user has explicitly set a mode (not 'auto'), use that.
 * If the user has 'auto' but gates haven't passed, fall back to 'off'.
 *
 * @param userMode - User's selected mode.
 * @param gateState - Current gate state.
 */
export function resolveEffectiveMode(
  userMode: ParallelConversionMode,
  gateState: GateState,
): ParallelConversionMode {
  // Explicit user choices are always respected.
  if (userMode === 'off' || userMode === 'manual') {
    return userMode;
  }

  // Auto mode: check gates.
  if (userMode === 'auto') {
    const gates = evaluateGates(gateState);
    if (gates.passed) {
      return 'auto';
    }
    // Gates haven't passed — fall back to off (sequential).
    console.log(`[auto-gate] Auto mode disabled: ${gates.reason}`);
    return 'off';
  }

  // Unknown mode: safest is off.
  return 'off';
}

/**
 * Record a benchmark result in the gate state.
 * Returns a new gate state (immutable).
 */
export function recordBenchmark(
  state: GateState,
  comparison: BenchmarkComparison,
): GateState {
  const benchmarks = [...state.benchmarks, comparison].slice(-10); // Keep last 10
  return {
    ...state,
    benchmarks,
  };
}

/**
 * Record a parallel conversion attempt result in the gate state.
 * Returns a new gate state (immutable).
 */
export function recordAttempt(
  state: GateState,
  success: boolean,
): GateState {
  return {
    ...state,
    totalAttempts: state.totalAttempts + 1,
    totalFailures: state.totalFailures + (success ? 0 : 1),
  };
}

