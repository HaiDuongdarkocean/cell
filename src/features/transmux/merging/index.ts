/** Transmux merging — sequential + parallel transmuxer, segment merger, mp4 validator, worker factory. */
export { transmuxTsToFmp4, type TransmuxResult } from './tsTransmuxer';
export {
  findFirstMoofOffset,
  readSegmentRanges,
  transmuxTsToFmp4ParallelExperimental,
  writeSegmentRanges,
  type ParallelTransmuxOptions,
  type ParallelTransmuxResult,
} from './parallelTransmuxer';
export { mergeTsSegments } from './segmentMerger';
export {
  validateFragmentedMp4,
  validateMergedMp4,
  type Mp4ValidationResult,
} from './mp4Validator';
// workerFactory intentionally NOT re-exported — it uses `import.meta.url`
// (invalid in Jest's CommonJS env) and is designed to be loaded only via
// dynamic import() inside parallelTransmuxer. Re-exporting it here would
// force Jest to parse it and break the test suite.
