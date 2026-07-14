/**
 * Detection feature — media/subtitle/script/language detection.
 *
 * Public API:
 * - detectVideo, detectSubtitle (network request → detected media)
 * - detectScript, detectLanguage (subtitle content → script/language)
 * - LANGUAGE_PROFILES, SCRIPT_RANGES (data tables)
 * - isoCodeToLabel, labelToIsoCode, extractPlainText (helpers)
 */
export {
  detectVideo,
} from './logic/videoDetector';
export {
  detectSubtitle,
  isStremioSubtitleListing,
} from './logic/subtitleDetector';
export {
  mapYouTubeCaptionTracks,
  extractCaptionTracks,
  buildVttUrl,
  requiresPoToken,
  type YouTubeCaptionTrack,
} from './logic/youtubeSubtitleDetector';
export {
  mapIqiyiSubtitleTracks,
  extractIqiyiStl,
  buildSrtUrl,
  type IqiyiSubtitleTrack,
} from './logic/iqiyiSubtitleDetector';
export {
  mapNetflixSubtitleTracks,
  type NetflixSubtitleTrack,
} from './logic/netflixSubtitleDetector';
export {
  fetchCaptionTracksViaInnerTube,
  extractInnertubeApiKey,
  extractClientVersion,
} from './logic/youtubeInnertube';
export {
  detectScript,
  scriptToCandidateLanguages,
  SCRIPT_RANGES,
  type ScriptId,
  type ScriptRange,
} from './logic/scriptDetector';
export {
  detectLanguage,
  detectLanguageFromText,
  isoCodeToLabel,
  labelToIsoCode,
  toIso6391,
  languageMatches,
  extractPlainText,
  LANGUAGE_PROFILES,
  type LanguageProfile,
} from './logic/languageDetector';
