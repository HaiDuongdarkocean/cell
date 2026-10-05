/** Subtitle logic — parsing, merge, sync, naming, import, auto-load, bilingual, drag-drop, offset. */
export { parseSubtitle } from './subtitleParser';
export { parseBilingualSrt } from './subtitleBilingualParser';
export { mergeCuesForPanel } from './subtitleMerge';
export { findCurrentLine } from './subtitleSync';
export { formatSubtitleName } from './subtitleNaming';
export {
  assignImportRole,
  createImportButton,
  handleFileSelect,
  parseAndDetectFiles,
  type ImportRoleAssignment,
  type ParsedFile,
} from './subtitleImport';
export { clearAutoLoadCache } from './autoLoadCache';
export {
  decompressSubtitleBytes,
  fetchAndParseSubtitle,
  formatFromUrl,
  handleAutoLoadSubtitles,
  resolveFormat,
  shouldAutoLoad,
  validateOverride,
  type AutoLoadConfig,
  type AutoLoadController,
  type AutoLoadDeps,
  type OverrideConfig,
  type OverrideResult,
} from './subtitleAutoLoad';
export {
  cacheSubtitleBody,
  clearSubtitleBodyCache,
  getCachedSubtitleBody,
  MAX_ENTRIES,
  waitForCachedSubtitleBody,
} from './subtitleResponseCache';
export {
  handleFileDrop,
  handleMultipleFilesDrop,
  readFileAsText,
  type FileParseResult,
} from './subtitleDragDrop';
export { clampYOffset, dragDeltaToYOffset } from './subtitleBlockDrag';
export {
  clampOffsetMs,
  effectiveTime,
  formatOffsetDisplay,
  parseOffsetInput,
} from './subtitleOffset';
export {
  clampDictionarySheetHeight,
  clampDockHeight,
  DOCK_MAX_HEIGHT_PERCENT,
  DOCK_MIN_HEIGHT_PX,
  resolvePlayerModeHostStyles,
  resolvePlayerModeLayout,
  resolvePlayerModeVideoStyles,
  resolveSplitViewWrapperHeight,
  resolveVideoAspectRatio,
  SHEET_MAX_HEIGHT_PERCENT,
  SHEET_MIN_HEIGHT_PX,
  togglePlayerMode,
  type PlayerModeActive,
  type PlayerModeLayout,
} from './playerModeGeometry';
export {
  installIframePlayerModeBridge,
  isChildFrame,
  requestIframePlayerModeEnter,
  requestIframePlayerModeExit,
  toggleTopFramePlayerMode,
} from './iframePlayerModeBridge';
