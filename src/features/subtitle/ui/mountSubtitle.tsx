import { mountReactShadow } from '@/shared/lib/shadowRoot/mountReactShadow';
import { isDevMode } from '@/shared/lib/env/devMode';
import { allModuleCss } from '@/shared/lib/shadowRoot/allModuleCss';
import { ShadowThemeProvider } from '@/features/theme';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import type { BilingualCue, NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';

import { SubtitlePanels, type SubtitlePanelsRef, type ManagerState, type OffsetState } from './SubtitlePanels';
import type { ToastVariant } from './SubtitleToast';
import type { SubtitlePracticeMode } from '@/features/studyModes';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import { buildTokenSpanCssForShadow } from '@/features/tokenize';
import type { CueListTokenize } from './CueList';
import type { ICON_CATALOG } from '@/shared/icons';

export type { SubtitlePanelsRef, ManagerState, OffsetState } from './SubtitlePanels';

type IconCatalogKey = keyof typeof ICON_CATALOG;

export interface MountSubtitleOptions {
  container: HTMLElement;
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;

  collapsed: boolean;
  isPlaying: boolean;
  repeatActive: boolean;
  repeatIcon?: IconCatalogKey;
  repeatLabel?: string;
  yOffsetPercent?: number;
  onDragReposition?: (yOffsetPercent: number) => void;
  manager?: ManagerState;
  offset?: OffsetState;
  generateNativeEnabled?: boolean;
  videoAspectRatio?: number;
  onTogglePlayerMode?: (active: boolean) => void;
  onPrev: () => void;
  onNext: () => void;
  onRepeat: () => void;
  onRewind: () => void;
  onForward: () => void;
  onPlayPause: () => void;
  onToggleCollapsed: () => void;
  onQuickAdd?: () => void;
  onEditCard?: () => void;
  onToggleOcr?: () => void;
  ocrEnabled?: boolean;
  onGenerateNative?: () => void;
  onToggleSidePanel?: () => void;
  onToggleManager?: () => void;
  /** Bilingual cues for CueList in Player Mode. */
  cues?: BilingualCue[];
  /** Current video time in ms (for CueList highlight). */
  currentTimeMs?: number;
  /** Subtitle offset in ms (ADR-019 sync). */
  offsetMs?: number;
  /** Seek video to timeMs when user clicks a cue. */
  onSeek?: (timeMs: number) => void;
  practiceMode?: SubtitlePracticeMode;
  onPracticeModeChange?: (mode: SubtitlePracticeMode) => void;
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void;
  onPreviousCue?: (cue: BilingualCue) => void;
  onReplayCue?: (cue: BilingualCue) => void;
  onContinueCue?: (cue: BilingualCue) => void;
}

export interface MountSubtitleResult {
  unmount: () => void;
  /** Shadow host element — use `host.shadowRoot` to query subtitle line elements. */
  readonly host: HTMLElement;
  setStyles: (targetStyle: OverlayStyleConfig, nativeStyle: OverlayStyleConfig) => void;
  setIsPlaying: (playing: boolean) => void;
  setRepeatActive: (active: boolean) => void;
  setRepeatIcon: (icon: IconCatalogKey, label?: string) => void;
  setManager: (manager: ManagerState) => void;
  setOffset: (offset: OffsetState) => void;
  setManagerOpen: (open: boolean) => void;
  setOffsetOpen: (open: boolean) => void;
  setHintOpen: (open: boolean) => void;
  setGenerateNativeEnabled: (enabled: boolean) => void;
  setVideoAspectRatio: (ratio: number) => void;
  setCollapsed: (collapsed: boolean) => void;
  setYOffsetPercent: (yOffsetPercent: number) => void;
  setClusterSettings: (settings: NavClusterSettings) => void;
  setBlockSettings: (settings: SubtitleBlockSettings) => void;
  addToast: (message: string, variant?: ToastVariant) => void;
  clearToasts: () => void;
  /** Update bilingual cues for CueList in Player Mode. */
  setCues: (cues: BilingualCue[]) => void;
  /** Enable/disable word-token rendering in cue lists. */
  setTokenize: (tokenize: CueListTokenize | null) => void;
  /** Update current video time (ms) for CueList highlight. */
  setCurrentTimeMs: (timeMs: number) => void;
  setPanelBlurred: (blurred: boolean) => void;
  /** Toggle whether bracketed content is stripped from the overlay. */
  setRemoveBracketed: (enabled: boolean) => void;
  togglePlayerMode: () => void;
  /** Toggle Split View — CueList panel beside video container (page thường only). */
  toggleSplitView: () => void;
  /** Update OCR enabled state (drives toolbar button active state). */
  setOcrEnabled: (enabled: boolean) => void;
  setPracticeMode: (mode: SubtitlePracticeMode) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
}

export function mountSubtitle(options: MountSubtitleOptions): MountSubtitleResult {
  const {
    container,
    targetStyle,
    nativeStyle,
    collapsed,
    isPlaying,
    repeatActive,
    repeatIcon,
    repeatLabel,
    yOffsetPercent,
    onDragReposition,
    manager,
    offset,
    generateNativeEnabled,
    videoAspectRatio,
    onTogglePlayerMode,
    onPrev,
    onNext,
    onRepeat,
    onRewind,
    onForward,
    onPlayPause,
    onToggleCollapsed,
    onQuickAdd,
    onEditCard,
    onToggleOcr,
    ocrEnabled,
    onGenerateNative,
    onToggleSidePanel,
    onToggleManager,
    cues,
    currentTimeMs,
    offsetMs,
    onSeek,
    practiceMode,
    onPracticeModeChange,
    onPlaybackSpeedChange,
    onPreviousCue,
    onReplayCue,
    onContinueCue,
  } = options;

  let controllerRef: SubtitlePanelsRef | null = null;

  const buildComponent = (): React.ReactElement => (
    <SubtitlePanels
      ref={(r) => { controllerRef = r; }}
      targetStyle={targetStyle}
      nativeStyle={nativeStyle}
      collapsed={collapsed}
      isPlaying={isPlaying}
      repeatActive={repeatActive}
      repeatIcon={repeatIcon}
      repeatLabel={repeatLabel}
      yOffsetPercent={yOffsetPercent ?? 75}
      onDragReposition={onDragReposition}
      manager={manager}
      offset={offset}
      generateNativeEnabled={generateNativeEnabled}
      videoAspectRatio={videoAspectRatio}
      onTogglePlayerMode={onTogglePlayerMode}
      onPrev={onPrev}
      onNext={onNext}
      onRepeat={onRepeat}
      onRewind={onRewind}
      onForward={onForward}
      onPlayPause={onPlayPause}
      onToggleCollapsed={onToggleCollapsed}
      onQuickAdd={onQuickAdd}
      onEditCard={onEditCard}
      onToggleOcr={onToggleOcr}
      ocrEnabled={ocrEnabled}
      onGenerateNative={onGenerateNative}
      onToggleSidePanel={onToggleSidePanel}
      onToggleManager={onToggleManager}
      cues={cues}
      currentTimeMs={currentTimeMs}
      offsetMs={offsetMs}
      onSeek={onSeek}
      practiceMode={practiceMode}
      onPracticeModeChange={onPracticeModeChange}
      onPlaybackSpeedChange={onPlaybackSpeedChange}
      onPreviousCue={onPreviousCue}
      onReplayCue={onReplayCue}
      onContinueCue={onContinueCue}
      managerShadowCss={[...allModuleCss, buildTokenSpanCssForShadow()]}
    />
  );

  const { unmount, host, rootEl, root } = mountReactShadow(
    buildComponent(),
    {
      parent: container,
      layer: 2,
      position: 'absolute',
      reparentOnFullscreen: true,
      css: [...allModuleCss, buildTokenSpanCssForShadow()],
    },
  );

  // Re-render with ShadowThemeProvider so data-theme + color tokens resolve
  // inside the shadow boundary. Without this, [data-theme="dark"] selectors
  // never match and buttons fall back to light-theme colors (invisible on dark dock).
  // Flushing sync ensures the imperative ref is populated before the caller
  // (e.g. ReactSubtitleController) starts driving the panel state. This is a
  // hard contract (ADR-097): without flushSync the ref is still null when the
  // caller's first setManager/setManagerOpen fire, and the `controllerRef?.`
  // optional chaining turns them into silent no-ops — the manager panel never
  // opens. Guarded by e2e/extension-subtitle-manager.spec.ts.
  flushSync(() => {
    root.render(
      createElement(ShadowThemeProvider, { container: rootEl }, buildComponent()),
    );
  });

  // Host fills the video container but lets clicks pass through to player controls.
  // pointer-events:none on host → player controls stay interactive.
  // .root (panelsRoot) sets pointer-events:auto on its interactive children.
  // z-overlay-video sits above every host-site player overlay (YouTube's
  // in-player ad/controls layers reach ~z:1000) but below Cell's body-level
  // surfaces (popup/panel/dialog) and portals (manager sheet, block layer).
  host.id = 'cell-subtitle-root';
  host.style.inset = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = 'var(--z-overlay-video, 10000)';

  const panels = (name: string): SubtitlePanelsRef | null => {
    if (controllerRef === null && isDevMode) {
      console.warn(`[mountSubtitle] ${name} dropped — panel controller not mounted`);
    }
    return controllerRef;
  };

  return {
    unmount,
    host,
    setStyles: (t, n) => panels('setStyles')?.setStyles(t, n),
    setIsPlaying: (playing) => panels('setIsPlaying')?.setIsPlaying(playing),
    setRepeatActive: (active) => panels('setRepeatActive')?.setRepeatActive(active),
    setRepeatIcon: (icon, label) => panels('setRepeatIcon')?.setRepeatIcon(icon, label),
    setManager: (m) => panels('setManager')?.setManager(m),
    setOffset: (o) => panels('setOffset')?.setOffset(o),
    setManagerOpen: (open) => panels('setManagerOpen')?.setManagerOpen(open),
    setOffsetOpen: (open) => panels('setOffsetOpen')?.setOffsetOpen(open),
    setHintOpen: (open) => panels('setHintOpen')?.setHintOpen(open),
    setGenerateNativeEnabled: (enabled) => panels('setGenerateNativeEnabled')?.setGenerateNativeEnabled(enabled),
    setVideoAspectRatio: (ratio) => panels('setVideoAspectRatio')?.setVideoAspectRatio(ratio),
    setCollapsed: (collapsed) => panels('setCollapsed')?.setCollapsed(collapsed),
    setYOffsetPercent: (y) => panels('setYOffsetPercent')?.setYOffsetPercent(y),
    setClusterSettings: (s) => panels('setClusterSettings')?.setClusterSettings(s),
    setBlockSettings: (s) => panels('setBlockSettings')?.setBlockSettings(s),
    addToast: (message, variant) => panels('addToast')?.addToast(message, variant),
    clearToasts: () => panels('clearToasts')?.clearToasts(),
    setCues: (cues) => panels('setCues')?.setCues(cues),
    setTokenize: (tokenize) => panels('setTokenize')?.setTokenize(tokenize),
    setCurrentTimeMs: (timeMs) => panels('setCurrentTimeMs')?.setCurrentTimeMs(timeMs),
    setPanelBlurred: (blurred) => panels('setPanelBlurred')?.setPanelBlurred(blurred),
    setRemoveBracketed: (enabled) => panels('setRemoveBracketed')?.setRemoveBracketed(enabled),
    togglePlayerMode: () => panels('togglePlayerMode')?.togglePlayerMode(),
    toggleSplitView: () => panels('toggleSplitView')?.toggleSplitView(),
    setOcrEnabled: (enabled) => panels('setOcrEnabled')?.setOcrEnabled(enabled),
    setPracticeMode: (mode) => panels('setPracticeMode')?.setPracticeMode(mode),
    setPlaybackSpeed: (speed) => panels('setPlaybackSpeed')?.setPlaybackSpeed(speed),
  };
}
