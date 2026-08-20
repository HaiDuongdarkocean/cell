/**
 * SSOT types for subtitle panels decomposition.
 *
 * Single source of truth for shared types used across `SubtitlePanels.tsx`,
 * `SubtitleManagerPanel.tsx`, and `logic/` files. Keeping types in a pure
 * type file (no JSX, no logic) breaks the `logic/` → UI file dependency.
 *
 * Spec: docs/specs/subtitle-panels-atom-decomposition.md (Decision D6)
 */

import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { NavClusterSettings, SubtitleBlockSettings, SubtitleApiKey } from '@/entities/settings';
import type { BilingualCue } from '@/entities/media';
import type { SubtitleSearchResult } from '@/features/subtitle/logic/subtitleSearchTypes';
import type { SubtitlePanelItem } from './subtitlePanelModel';
import type { ToastVariant } from './SubtitleToast';
import { ICON_CATALOG } from '@/shared/icons';

type IconCatalogKey = keyof typeof ICON_CATALOG;

export type { IconCatalogKey };
export type { SubtitlePanelItem };

export interface AppearanceState {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  blockSettings: SubtitleBlockSettings;
  clusterSettings: NavClusterSettings;
  defaultTargetStyle: OverlayStyleConfig;
  defaultNativeStyle: OverlayStyleConfig;
  previewTargetText: string;
  previewNativeText: string;
  onStyleChange: (role: 'target' | 'native', partial: Partial<OverlayStyleConfig>) => void;
  onBlockSettingsChange: (partial: Partial<SubtitleBlockSettings>) => void;
  onClusterSettingsChange: (partial: Partial<NavClusterSettings>) => void;
  onResetStyle: (role: 'target' | 'native') => void;
  onPreviewTextChange: (role: 'target' | 'native', text: string) => void;
}

export interface ManagerState {
  targetItems: SubtitlePanelItem[];
  nativeItems: SubtitlePanelItem[];
  targetActiveIndex: number;
  nativeActiveIndex: number;
  onSelect: (role: 'target' | 'native', index: number) => void;
  onImport?: (role: 'target' | 'native') => void;
  onGenerateNative?: () => void;
  onOffsetChange?: (role: 'target' | 'native', ms: number) => void;
  /** Appearance view props — when provided, "Customize appearance" button shows in footer. */
  appearance?: AppearanceState;
  /** Whether subtitle search API keys are configured (controls search UI availability). */
  hasSearchKeys: boolean;
  /** API keys for subtitle search (for inline ApiKeyManager in search view). */
  apiKeys: readonly SubtitleApiKey[];
  /** Persist API key changes to settings storage. */
  onApiKeysChange: (keys: SubtitleApiKey[]) => void;
  /** User selected a search result to download + load (delegated to contentScriptController). */
  onSearchResultSelect: (result: SubtitleSearchResult, role: 'target' | 'native') => void;
  /** Download a specific subtitle item to the user's machine. */
  onDownload?: (role: 'target' | 'native', index: number) => void;
  /** Toggle hide/show for a section's subtitle in the overlay. */
  onHideSection?: (role: 'target' | 'native') => void;
  /** Toggle hide/show for both target + native subtitles in the overlay. */
  onHideBoth?: () => void;
  /** Whether target subtitle is currently hidden in the overlay. */
  targetHidden?: boolean;
  /** Whether native subtitle is currently hidden in the overlay. */
  nativeHidden?: boolean;
  /** Whether both subtitles are currently hidden in the overlay. */
  bothHidden?: boolean;
}

export interface OffsetState {
  targetMs: number;
  nativeMs: number;
  onTargetChange: (ms: number) => void;
  onNativeChange: (ms: number) => void;
}

export interface SubtitlePanelsRef {
  /** Update target + native overlay styles. */
  setStyles: (targetStyle: OverlayStyleConfig, nativeStyle: OverlayStyleConfig) => void;
  /** Update nav cluster settings (buttonSize, textOpacity, bgOpacity, enabled). */
  setClusterSettings: (settings: NavClusterSettings) => void;
  /** Update subtitle block settings (bgOpacity, globalScale, yOffsetPercent). */
  setBlockSettings: (settings: SubtitleBlockSettings) => void;
  /** Replace the manager items and callbacks. */
  setManager: (manager: ManagerState) => void;
  /** Replace the offset state and callbacks. */
  setOffset: (offset: OffsetState) => void;
  /** Show or hide the subtitle manager panel. */
  setManagerOpen: (open: boolean) => void;
  /** Show or hide the offset panel. */
  setOffsetOpen: (open: boolean) => void;
  /** Show or hide the drag/drop hint. */
  setHintOpen: (open: boolean) => void;
  /** Add a toast notification. */
  addToast: (message: string, variant?: ToastVariant) => void;
  /** Clear all toasts. */
  clearToasts: () => void;
  /** Update whether the video is playing. */
  setIsPlaying: (playing: boolean) => void;
  /** Update the repeat AB-loop active state. */
  setRepeatActive: (active: boolean) => void;
  /** Update the repeat button icon and label. */
  setRepeatIcon: (icon: IconCatalogKey, label?: string) => void;
  /** Enable or disable the manager-panel generate-native button. */
  setGenerateNativeEnabled: (enabled: boolean) => void;
  /** Collapse or expand the nav cluster. */
  setCollapsed: (collapsed: boolean) => void;
  /** Update the block vertical position (percent 0-95). */
  setYOffsetPercent: (yOffsetPercent: number) => void;
  /** Update bilingual cues for CueList in Player Mode. */
  setCues: (cues: BilingualCue[]) => void;
  /** Update current video time (ms) for CueList highlight. */
  setCurrentTimeMs: (timeMs: number) => void;
  /** Toggle Player Mode (same as clicking the Player Mode button). */
  togglePlayerMode: () => void;
  /** Toggle Split View — CueList panel beside video container (page thường only). */
  toggleSplitView: () => void;
}

export interface SubtitlePanelsProps {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  collapsed: boolean;
  isPlaying: boolean;
  repeatActive: boolean;
  repeatIcon?: IconCatalogKey;
  repeatLabel?: string;
  /** Nav cluster settings from extension popup. */
  clusterSettings?: NavClusterSettings;
  /** Subtitle block settings from extension popup. */
  blockSettings?: SubtitleBlockSettings;
  /** Block vertical position as percent of video height (0-95, center of block). ADR-025. */
  yOffsetPercent: number;
  /** Called when user drags the block to a new Y position (percent 0-95, snapped). */
  onDragReposition?: (yOffsetPercent: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onRepeat: () => void;
  onRewind: () => void;
  onForward: () => void;
  onPlayPause: () => void;
  onToggleCollapsed: () => void;
  /** Quick-add all unknown/tracking words in the current subtitle line. */
  onQuickAdd?: () => void;
  /** Open the Card Creator dialog pre-filled for the current line. */
  onEditCard?: () => void;
  /** Update the card matching the current subtitle line. */
  onUpdateCurrentCard?: () => void;
  /** Generate a native subtitle from the current target cues. */
  onGenerateNative?: () => void;
  /** Open/close the Chrome side panel. */
  onToggleSidePanel?: () => void;
  /** Open the subtitle manager panel. */
  onToggleManager?: () => void;
  manager?: ManagerState;
  offset?: OffsetState;
  generateNativeEnabled?: boolean;
  /** Intrinsic video width/height ratio used by Player Mode layout. */
  videoAspectRatio?: number;
  /** Called when user toggles Player Mode. */
  onTogglePlayerMode?: (active: boolean) => void;
  /** Bilingual cues for CueList in Player Mode. */
  cues?: BilingualCue[];
  /** Current video time in ms (for CueList highlight). */
  currentTimeMs?: number;
  /** Subtitle offset in ms (ADR-019 sync). */
  offsetMs?: number;
  /** Seek video to timeMs when user clicks a cue. */
  onSeek?: (timeMs: number) => void;
  /** CSS strings to inject into the body-level shadow root for the manager panel.
   *  Needed because the manager panel portals to document.body to escape the
   *  video container's stacking context (e.g. YouTube #movie_player z-index:0). */
  managerShadowCss?: string[];
}
