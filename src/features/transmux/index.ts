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
export * from './merging';
export * from './planning';
export * from './execution';
