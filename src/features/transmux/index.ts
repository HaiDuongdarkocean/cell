/**
 * Transmux feature — TS→fMP4 transmuxing pipeline.
 *
 * Layers (low → high):
 * - merging/    — sequential + parallel transmuxer, segment merger,
 *                 mp4 validator, conversion timer, worker factory
 * - planning/   — policy resolution, segment grouping, parallel plan
 * - execution/  — coordinator, fallback, cancellation, safety, progress,
 *                 auto-enablement gates, benchmark harness
 */
export {
  findFirstMoofOffset,
  mergeTsSegments,
  readSegmentRanges,
  transmuxTsToFmp4,
  transmuxTsToFmp4ParallelExperimental,
  validateFragmentedMp4,
  validateMergedMp4,
  writeSegmentRanges,
  type Mp4ValidationResult,
  type ParallelTransmuxOptions,
  type ParallelTransmuxResult,
  type TransmuxResult,
} from './merging';
export {
  groupSegmentsByBytes,
  planParallelConversion,
  resolveParallelPolicy,
  type ParallelPlan,
  type ParallelPolicy,
  type SegmentGroup,
} from './planning';
export {
  analyzeParallelSafety,
  CancellationToken,
  CancellationTokenRegistry,
  cancelParallelConversion,
  cleanupParallelTempFiles,
  compareBenchmarks,
  decideFallback,
  DEFAULT_GATE_STATE,
  evaluateGates,
  executeParallelConversion,
  executeWithFallback,
  formatBenchmarkComparison,
  formatBenchmarkResult,
  isParallelConversionCancelled,
  ParallelConversionCancelledError,
  ParallelProgressTracker,
  phaseLabel,
  phaseToPercent,
  recordAttempt,
  recordBenchmark,
  resolveEffectiveMode,
  runBenchmark,
  type BenchmarkComparison,
  type BenchmarkResult,
  type FallbackDecision,
  type GateState,
  type ParallelConversionPhase,
  type ParallelConversionResult,
  type SafetyAnalysis,
} from './execution';
