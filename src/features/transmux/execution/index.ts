/** Transmux execution — coordinator, fallback, cancellation, safety, progress, gates, benchmark. */
export {
  cancelParallelConversion,
  executeParallelConversion,
  isParallelConversionCancelled,
  type ParallelConversionResult,
} from './parallelCoordinator';
export {
  decideFallback,
  executeWithFallback,
  type FallbackDecision,
} from './parallelFallback';
export {
  CancellationToken,
  CancellationTokenRegistry,
  cleanupParallelTempFiles,
  ParallelConversionCancelledError,
} from './parallelCancellation';
export {
  ParallelProgressTracker,
  phaseLabel,
  phaseToPercent,
  type ParallelConversionPhase,
} from './parallelProgress';
export { analyzeParallelSafety, type SafetyAnalysis } from './parallelSafetyAnalyzer';
export {
  DEFAULT_GATE_STATE,
  evaluateGates,
  recordAttempt,
  recordBenchmark,
  resolveEffectiveMode,
  type GateState,
} from './autoEnablement';
export {
  compareBenchmarks,
  formatBenchmarkComparison,
  formatBenchmarkResult,
  runBenchmark,
  type BenchmarkComparison,
  type BenchmarkResult,
} from './benchmarkHarness';
