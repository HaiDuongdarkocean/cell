// Generic subtitle-list discovery feature.
//
// Public API: signal types, candidate/pipeline, and default adapters.

export { SubtitleDiscoveryPipeline } from './pipeline';
export { createDefaultAdapters } from './adapters';
export { createFetchText } from './fetchText';
export {
  createCandidate,
  formatFromUrl,
  formatFromContent,
  resolveLanguage,
  languageFromLabel,
  languageFromPath,
  buildCandidateIdentity,
  resolveRelativeUrl,
  type CandidateInit,
} from './candidate';
export {
  subtitleSignalSchema,
  subtitleDiscoveryPayloadSchema,
  subtitleDiscoveryBridgePayloadSchema,
} from './schema';
export * from './types';
