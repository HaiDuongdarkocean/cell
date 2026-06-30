/**
 * Benchmark harness for parallel vs sequential conversion.
 *
 * Provides utilities to measure conversion time and compare
 * parallel vs sequential performance. Used by Task 18 to collect
 * benchmark data from real samples and local fixtures.
 */

export interface BenchmarkResult {
  readonly mode: 'sequential' | 'parallel';
  readonly workerCount: number;
  readonly inputBytes: number;
  readonly durationMs: number;
  readonly throughputMBps: number;
  readonly success: boolean;
  readonly error?: string;
}

export interface BenchmarkComparison {
  readonly sequential: BenchmarkResult;
  readonly parallel: BenchmarkResult;
  readonly speedup: number;
  readonly verdict: 'parallel-faster' | 'sequential-faster' | 'inconclusive';
}

/**
 * Run a benchmark for a single conversion mode.
 *
 * @param mode - 'sequential' or 'parallel'
 * @param workerCount - Workers for parallel mode (ignored for sequential)
 * @param inputBytes - Input file size in bytes
 * @param convertFn - Function that performs the conversion
 */
export async function runBenchmark(
  mode: 'sequential' | 'parallel',
  workerCount: number,
  inputBytes: number,
  convertFn: () => Promise<{ success: boolean; error?: string }>,
): Promise<BenchmarkResult> {
  const start = performance.now();
  let result: { success: boolean; error?: string };
  try {
    result = await convertFn();
  } catch (err: unknown) {
    result = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const durationMs = Math.round(performance.now() - start);
  const throughputMBps = durationMs > 0
    ? (inputBytes / (1024 * 1024)) / (durationMs / 1000)
    : 0;

  return {
    mode,
    workerCount,
    inputBytes,
    durationMs,
    throughputMBps: Math.round(throughputMBps * 100) / 100,
    success: result.success,
    error: result.error,
  };
}

/**
 * Compare sequential vs parallel benchmark results.
 */
export function compareBenchmarks(
  sequential: BenchmarkResult,
  parallel: BenchmarkResult,
): BenchmarkComparison {
  if (!sequential.success || !parallel.success) {
    return {
      sequential,
      parallel,
      speedup: 0,
      verdict: 'inconclusive',
    };
  }

  const speedup = sequential.durationMs / parallel.durationMs;
  const verdict = speedup > 1.1
    ? 'parallel-faster' as const
    : speedup < 0.9
      ? 'sequential-faster' as const
      : 'inconclusive' as const;

  return {
    sequential,
    parallel,
    speedup: Math.round(speedup * 100) / 100,
    verdict,
  };
}

/**
 * Format a benchmark result for logging.
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
  const status = result.success ? 'OK' : 'FAIL';
  const mb = (result.inputBytes / (1024 * 1024)).toFixed(1);
  return `[benchmark] ${result.mode} (${result.workerCount}w): ${status} ${mb}MB in ${result.durationMs}ms @ ${result.throughputMBps}MB/s${result.error ? ` — ${result.error}` : ''}`;
}

/**
 * Format a benchmark comparison for logging.
 */
export function formatBenchmarkComparison(comparison: BenchmarkComparison): string {
  const speedupStr = comparison.speedup > 0
    ? `${comparison.speedup}x speedup`
    : 'N/A';
  return `[benchmark] ${comparison.verdict} — sequential: ${comparison.sequential.durationMs}ms, parallel: ${comparison.parallel.durationMs}ms (${speedupStr})`;
}
