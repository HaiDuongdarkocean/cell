export { createTokenList, applyTokenListStatus } from './logic/tokenListMetadata';
export {
  createCueListTokenMap,
  resolveCueListTokenMetadata,
  applyCueListTokenStatus,
  applyCueListTokenStatuses,
  type CueListTokenMap,
  type ResolveMeta,
  type ResolvedCueListTokens,
} from './logic/cueListTokens';
export {
  DEFAULT_BAND_THRESHOLDS,
  loadFrequencyBandOptions,
  pickBestFrequencyEntry,
  type FrequencyBandOptions,
  type FrequencyBandThresholds,
} from './utils/frequencyBand';
export type { Token, TokenBlock, TokenizeController, TokenizeState, TokenFrequencyBand } from './types';
export type { PopupStatusTarget } from './logic/statusKeyControls';
export { tokenizeTextBlock } from './logic/textTokenizer';
export {
  createScoreTracker,
  isScorableToken,
  computeStats,
  COMPREHENSION_BAND_MIN,
  type ScoreTracker,
} from './logic/comprehensionScore';
export { fetchTermStatuses } from './services/scoreStatusFetch';
export {
  startTokenScoreSource,
  type TokenScoreSourceDeps,
} from './services/tokenScoreSource';
export {
  createComprehensionStore,
  comprehensionStore,
  type ComprehensionStore,
  type ComprehensionState,
} from './services/comprehensionStore';
export { ComprehensionBadge } from './ui/ComprehensionBadge';
export { resolveTokenListMetadata } from './logic/tokenListMetadata';
export type { TokenizeSettings, TokenizePanelState } from './types';
export { buildTokenSpanCssForShadow } from './ui/tokenSpanCss';
export { ViewportTracker } from './logic/viewportTracker';
export { loadTokenizeSettings, isSubtitleTokenizeEnabledForUrl } from './services/tokenizeSettingsStore';
export type { SubtitleTokenizeController } from './controller/subtitleTokenizeController';
export { createSubtitleTokenizeController, type SubtitleTokenizeControllerOptions } from './controller/subtitleTokenizeController';
