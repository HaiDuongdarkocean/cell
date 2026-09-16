/** Subtitle UI — overlay, panel, manager, shortcuts, toast, UI helpers. */
export {
  handleShortcutKey,
  isActivatableTarget,
  isEditableEvent,
  isEditableTarget,
  isInsideCellUi,
} from './subtitleShortcuts';
export {
  applyStyle,
  buildClusterCssVars,
  buildTextShadow,
  createDebouncedToast,
  createDragHint,
  createOverlayLayer,
  hexToRgba,
  hideOverlay,
  removeOverlay,
  sanitizeFontFamily,
  showProgressToast,
  showToast,
  updateOverlayText,
  type ProgressToastHandle,
  type ToastOptions,
  type ToastVariant,
} from './subtitleUI';
export {
  SubtitleCueEngine,
  type CardCreatorAction,
  type NavClusterIconName,
  type SubtitleCueEngineCallbacks,
  type SubtitleCueEngineDictionaryOptions,
  type SubtitleCueEngineRepeatState,
  type SubtitleCueEngineTokenizeOptions,
  type SubtitleCueEngineUpdate,
} from './subtitleCueEngine';
export { ReactSubtitleController } from './reactSubtitleController';
export { mountSubtitle } from './mountSubtitle';
export { SubtitlePanels } from './SubtitlePanels';
export { SubtitleManagerPanel } from './SubtitleManagerPanel';
export { SubtitleOffsetPanel } from './SubtitleOffsetPanel';
export { ClusterRightToolbar } from './ClusterRightToolbar';
export { ManagerLayer } from './ManagerLayer';
export { OffsetLayer } from './OffsetLayer';
export type { ManagerState, OffsetState, SubtitlePanelsRef, SubtitlePanelsProps, AppearanceState } from './subtitlePanelsTypes';
export { SubtitleToast } from './SubtitleToast';
export { SubtitleHint } from './SubtitleHint';
export {
  extractLanguageName,
  formatBytes,
  type SubtitlePanelItem,
} from './subtitlePanelModel';
export {
  isNetflixPage,
  mountToWatchVideo,
  pauseVideo,
  playVideo,
  resumeIfPaused,
  SEEK_LANDING_EPS_MS,
  seekToCue,
  seekVideo,
} from '@/shared/lib/dom/netflixPlayback';
export {
  broadcastCues,
  createTranslateFunction,
  loadSettingsOrToast,
} from './subtitleControllerHelpers';
export { navigateCue, toggleOverlayState } from './shortcutActionDispatcher';
export { init as initContentScriptController } from './contentScriptController';
export {
  SubtitleSyncController,
  type OcrTrackSlot,
  type PreOcrSources,
  type SubtitleSyncControllerDeps,
  type TranslatedNativeSlot,
} from './subtitleSyncController';
