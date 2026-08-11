import type { SrtCue, NavClusterSettings, SubtitleBlockSettings, Settings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import {
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_NAV_CLUSTER_SETTINGS,
} from '@/shared/config/config';
import { mountSubtitle, type MountSubtitleResult, type ManagerState, type OffsetState } from './mountSubtitle';
import { SubtitleCueEngine, type SubtitleCueEngineUpdate, type CardCreatorAction, type SubtitleCueEngineTokenizeOptions } from './subtitleCueEngine';
import type { TriggerMode, LookupRequest } from '@/features/dictionaryPopup/types';
import { clampOffsetMs } from '@/features/subtitle/logic/subtitleOffset';
import { mergeCuesForPanel } from '@/features/subtitle/logic/subtitleMerge';
import { resolvePlayerModeLayout, resolveVideoAspectRatio, DOCK_MIN_HEIGHT_PX } from '@/features/subtitle/logic/playerModeGeometry';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { createPlayerModeHostController, type PlayerModeHostController } from './playerModeHost';

import { ICON_CATALOG } from '@/shared/icons';

const OFFSET_SETTINGS_KEY = 'subtitleOffset';
const OFFSET_PERSIST_DEBOUNCE_MS = 300;

type IconCatalogKey = keyof typeof ICON_CATALOG;

const REPEAT_ICON_MAP: Record<string, IconCatalogKey> = {
  repeat: 'navRepeat',
  repeatA: 'navRepeatA',
  repeatB: 'navRepeatB',
  repeatCancel: 'navRepeatCancel',
};

export class ReactSubtitleController {
  private readonly engine: SubtitleCueEngine;
  private readonly mount: MountSubtitleResult;
  private readonly video: HTMLVideoElement;
  private readonly container: HTMLElement;
  private playerModeHost: PlayerModeHostController | null = null;
  private readonly videoAspectRatio: number;
  private readonly url: string;
  private readonly onGenerateNative: () => void;
  private readonly onCardCreatorAction: (action: CardCreatorAction) => void;
  private readonly onUpdateCurrentCard: () => void;
  private offsetMs = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private yOffsetPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private hasSubtitle = false;
  private isPlaying = false;
  private repeatActive = false;
  private repeatIcon: IconCatalogKey = 'navRepeat';
  private repeatLabel = 'Repeat current sentence';
  private managerTargetItems: import('./subtitlePanelModel').SubtitlePanelItem[] = [];
  private managerNativeItems: import('./subtitlePanelModel').SubtitlePanelItem[] = [];
  private managerTargetActiveIndex = 0;
  private managerNativeActiveIndex = 0;
  private generateNativeEnabled = true;

  private playerModeResizeHandler: (() => void) | null = null;

  /** Called when the user selects a subtitle track from the manager panel. */
  public onManagerSelect?: (role: 'target' | 'native', index: number) => void;
  /** Called when the user imports a subtitle file. */
  public onImportFiles?: (role: 'target' | 'native', files: FileList) => void;
  /** Called when the user toggles the Chrome side panel. */
  public onToggleSidePanel?: () => void;
  /** Called when active cue indices change (for subtitle tokenize rendering). */
  public onCuesUpdated?: () => void;

  /** Whether Player Mode overlay is currently active. */
  public isPlayerModeActive = false;

  constructor(
    video: HTMLVideoElement,
    container: HTMLElement,
    blockSettings: SubtitleBlockSettings = DEFAULT_SUBTITLE_BLOCK_SETTINGS,
    targetStyle: OverlayStyleConfig = DEFAULT_OVERLAY_STYLE_TARGET,
    nativeStyle: OverlayStyleConfig = DEFAULT_OVERLAY_STYLE_NATIVE,
    clusterSettings: NavClusterSettings = DEFAULT_NAV_CLUSTER_SETTINGS,
    onCardCreatorAction: (action: CardCreatorAction) => void = () => undefined,
    onUpdateCurrentCard: () => void = () => undefined,
    onGenerateNative: () => void = () => undefined,
  ) {
    this.video = video;
    this.container = container;
    const videoRect = video.getBoundingClientRect();
    this.videoAspectRatio = resolveVideoAspectRatio(
      video.videoWidth,
      video.videoHeight,
      resolveVideoAspectRatio(videoRect.width, videoRect.height),
    );
    this.url = window.location?.href ?? '';
    this.onCardCreatorAction = onCardCreatorAction;
    this.onUpdateCurrentCard = onUpdateCurrentCard;
    this.onGenerateNative = onGenerateNative;

    this.loadPersistedOffset();

    this.engine = new SubtitleCueEngine(
      video,
      blockSettings,
      targetStyle,
      nativeStyle,
      clusterSettings,
      () => this.getOffsetMs(),
      {
        onCuesUpdated: () => this.syncFromEngine(),
        onStyleUpdated: () => this.updateStylesFromEngine(),
        onPlayPause: (playing) => this.setIsPlaying(playing),
        onGenerateNativeEnabled: (enabled) => this.applyGenerateNativeEnabled(enabled),
      },
    );

    this.isPlaying = !video.paused;
    video.addEventListener('play', this.onVideoPlay);
    video.addEventListener('pause', this.onVideoPause);

    this.mount = mountSubtitle({
      container,
      targetStyle,
      nativeStyle,
      collapsed: false,
      hasSubtitle: false,
      isPlaying: this.isPlaying,
      repeatActive: false,
      repeatIcon: this.repeatIcon,
      repeatLabel: this.repeatLabel,
      yOffsetPercent: blockSettings.yOffsetPercent,
      onDragReposition: (y) => this.handleDragReposition(y),
      manager: this.buildManagerState(),
      offset: this.buildOffsetState(),
      generateNativeEnabled: this.generateNativeEnabled,
      videoAspectRatio: this.videoAspectRatio,
      onTogglePlayerMode: (active) => this.handlePlayerModeToggle(active),
      onPrev: () => this.engine.handlePrev(),
      onNext: () => this.engine.handleNext(),
      onRepeat: () => this.handleRepeat(),
      onRewind: () => this.engine.handleRewind(),
      onForward: () => this.engine.handleForward(),
      onPlayPause: () => this.engine.handlePlayPause(),
      onToggleCollapsed: () => this.handleToggleCollapsed(),
      onQuickAdd: () => this.onCardCreatorAction('quick-update'),
      onEditCard: () => this.onCardCreatorAction('edit-card'),
      onUpdateCurrentCard: () => this.onUpdateCurrentCard(),
      onGenerateNative: () => this.onGenerateNative(),
      onToggleSidePanel: () => this.onToggleSidePanel?.(),
      onToggleManager: () => this.openManager(),
      cues: [],
      currentTimeMs: video.currentTime * 1000,
      offsetMs: this.offsetMs,
      onSeek: (timeMs: number) => this.handleCueSeek(timeMs),
    });

    // Wire video timeupdate → engine.onTimeUpdate so active cue index tracks
    // playback. Without this, loadBilingualCues sets index=-1 and the block
    // stays empty until the next load/offset change.
    // Also update CueList currentTimeMs for highlight sync in Player Mode.
    video.addEventListener('timeupdate', () => {
      this.engine.onTimeUpdate();
      this.mount.setCurrentTimeMs(video.currentTime * 1000);
    });
  }

  private loadPersistedOffset(): void {
    try {
      loadSettings().then((settings) => {
        const persisted = settings.subtitleOffset?.[this.url];
        if (typeof persisted === 'number' && !Number.isNaN(persisted)) {
          this.offsetMs = clampOffsetMs(persisted);
        }
      });
    } catch {
      // ignore
    }
  }

  private persistOffset(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      saveSettings({ [OFFSET_SETTINGS_KEY]: { [this.url]: this.offsetMs } } as Partial<Settings>).catch(() => undefined);
    }, OFFSET_PERSIST_DEBOUNCE_MS);
  }

  /** ADR-025: drag reposition → update engine block settings + persist yOffsetPercent. */
  private handleDragReposition(yOffsetPercent: number): void {
    this.engine.updateBlockSettings({ yOffsetPercent });
    this.mount.setYOffsetPercent(yOffsetPercent);
    if (this.yOffsetPersistTimer) clearTimeout(this.yOffsetPersistTimer);
    this.yOffsetPersistTimer = setTimeout(() => {
      this.yOffsetPersistTimer = null;
      const current = this.engine.getBlockSettings();
      saveSettings({ subtitleBlockSettings: { ...current, yOffsetPercent } } as Partial<Settings>).catch(() => undefined);
    }, OFFSET_PERSIST_DEBOUNCE_MS);
  }

  private buildManagerState(): ManagerState {
    return {
      targetItems: this.managerTargetItems,
      nativeItems: this.managerNativeItems,
      targetActiveIndex: this.managerTargetActiveIndex,
      nativeActiveIndex: this.managerNativeActiveIndex,
      onSelect: (role, index) => this.onManagerSelect?.(role, index),
      onImport: this.onImportFiles ? (role) => this.openImportFileInput(role) : undefined,
      onGenerateNative: () => this.onGenerateNative(),
      onOffsetChange: (_role, ms) => this.setOffsetMs(ms),
    };
  }

  private buildOffsetState(): OffsetState {
    return {
      targetMs: this.offsetMs,
      nativeMs: this.offsetMs,
      onTargetChange: (ms) => this.setOffsetMs(ms),
      onNativeChange: (ms) => this.setOffsetMs(ms),
    };
  }

  private openImportFileInput(role: 'target' | 'native'): void {
    if (!this.onImportFiles) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt,.vtt';
    input.style.display = 'none';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.onImportFiles?.(role, files);
      }
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  }

  private syncFromEngine(): void {
    this.hasSubtitle = this.engine.hasSubtitles();
    this.mount.setHasSubtitle(this.hasSubtitle);
    this.setIsPlaying(!this.video.paused);
    this.onCuesUpdated?.();
  }

  private updateStylesFromEngine(): void {
    this.mount.setStyles(this.engine.getTargetStyle(), this.engine.getNativeStyle());
    this.mount.setClusterSettings(this.engine.getClusterSettings());
    this.mount.setBlockSettings(this.engine.getBlockSettings());
  }

  private setIsPlaying(playing: boolean): void {
    this.isPlaying = playing;
    this.mount.setIsPlaying(playing);
  }

  // SSOT: video element là nguồn sự thật cho play/pause state. Listener này
  // bắt mọi nguồn (keyboard shortcut, host UI click, programmatic) → NavCluster
  // icon luôn sync. Trước đó chỉ engine.handlePlayPause callback mới update.
  private readonly onVideoPlay = (): void => this.setIsPlaying(true);
  private readonly onVideoPause = (): void => this.setIsPlaying(false);

  private applyGenerateNativeEnabled(enabled: boolean): void {
    this.generateNativeEnabled = enabled;
    this.mount.setGenerateNativeEnabled(enabled);
  }

  private handleRepeat(): void {
    if (this.engine.hasSubtitles()) {
      this.engine.repeatOnce();
      return;
    }
    const state = this.engine.handleNoSubRepeatClick();
    this.repeatActive = state.active;
    this.repeatIcon = REPEAT_ICON_MAP[state.icon] ?? 'navRepeat';
    this.repeatLabel = state.label;
    this.mount.setRepeatActive(this.repeatActive);
    this.mount.setRepeatIcon(this.repeatIcon, this.repeatLabel);
  }

  private handleToggleCollapsed(): void {
    // Drag/collapse persistence is not yet implemented in the React UI.
  }

  /** Seek video to a cue's raw start time (ms). Shifts by -offsetMs so the
      overlay displays that cue (ADR-019 sync, mirrors SEEK_TO handler). */
  private handleCueSeek(timeMs: number): void {
    this.video.currentTime = (timeMs - this.offsetMs) / 1000;
  }

  setOffsetProvider(_provider: () => number): void {
    // The React controller owns the offset provider internally.
  }

  updateSettings(update: SubtitleCueEngineUpdate): void {
    this.engine.updateSettings(update);
    this.updateStylesFromEngine();
  }

  loadCues(cues: readonly SrtCue[]): void;
  loadCues(hasSubtitle: boolean): void;
  loadCues(arg: readonly SrtCue[] | boolean): void {
    if (typeof arg === 'boolean') {
      this.hasSubtitle = arg;
      this.mount.setHasSubtitle(arg);
      return;
    }
    this.engine.loadCues([...arg]);
    this.engine.onTimeUpdate();
    this.syncFromEngine();
  }

  loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
    this.engine.loadBilingualCues(targetCues, nativeCues);
    this.engine.onTimeUpdate();
    this.syncFromEngine();
    // Sync CueList in Player Mode with merged bilingual cues.
    this.mount.setCues(mergeCuesForPanel(targetCues, nativeCues));
  }

  clearCues(): void {
    this.engine.clearCues();
    this.syncFromEngine();
    this.mount.setCues([]);
  }

  getTargetCues(): readonly SrtCue[] {
    return this.engine.getTargetCues();
  }

  getNativeCues(): readonly SrtCue[] {
    return this.engine.getNativeCues();
  }

  getCurrentTargetText(): string {
    return this.engine.getCurrentTargetText();
  }

  getCurrentNativeText(): string {
    return this.engine.getCurrentNativeText();
  }

  setGenerateNativeEnabled(enabled: boolean): void {
    this.engine.setGenerateNativeEnabled(enabled);
  }

  getOffsetMs(): number {
    return this.offsetMs;
  }

  setOffsetMs(ms: number): void {
    this.offsetMs = clampOffsetMs(ms);
    this.persistOffset();
    this.mount.setOffset(this.buildOffsetState());
    // Re-render current cue with new offset.
    this.engine.onTimeUpdate();
  }

  stepBy(deltaMs: number): void {
    this.setOffsetMs(this.offsetMs + deltaMs);
  }

  reset(): void {
    this.setOffsetMs(0);
  }

  // === OffsetController-style API (used by contentScriptController) ===

  init(): void {
    // React mount happens in the constructor; no additional init required.
  }

  // === Subtitle manager panel (legacy managerPanel replacement) ===

  updateManagerItems(role: 'target' | 'native', items: import('./subtitlePanelModel').SubtitlePanelItem[], activeIndex: number): void {
    if (role === 'target') {
      this.managerTargetItems = items;
      this.managerTargetActiveIndex = activeIndex;
    } else {
      this.managerNativeItems = items;
      this.managerNativeActiveIndex = activeIndex;
    }
    this.mount.setManager(this.buildManagerState());
  }

  openManager(): void {
    this.mount.setManagerOpen(true);
  }

  closeManager(): void {
    this.mount.setManagerOpen(false);
  }

  // === Tokenize / dictionary: state is stored in the cue engine. ===

  enableTokenize(options: SubtitleCueEngineTokenizeOptions): void {
    this.engine.enableTokenize(options);
  }

  disableTokenize(): void {
    this.engine.disableTokenize();
  }

  isTokenizeEnabled(): boolean {
    return this.engine.isTokenizeEnabled();
  }

  /** Shadow host element — for querying subtitle line elements in the shadow DOM. */
  getHost(): HTMLElement {
    return this.mount.host;
  }

  /** Query the shadow DOM for the current target/native line span elements.
   *  Returns the inner <span> that directly contains the text node, so the
   *  subtitle tokenize controller can bind token spans into it. */
  getLineElements(): { target: HTMLElement | null; native: HTMLElement | null } {
    const root = this.mount.host.shadowRoot;
    if (!root) return { target: null, native: null };
    return {
      target: root.querySelector('[data-role="target"] span'),
      native: root.querySelector('[data-role="native"] span'),
    };
  }

  private getPlayerModeVideoStageHeight(): number {
    return resolvePlayerModeLayout(
      window.innerWidth,
      window.innerHeight,
      this.videoAspectRatio,
      DOCK_MIN_HEIGHT_PX,
    ).videoStageHeight;
  }

  private setPlayerModeBounds(videoStageHeight: number): void {
    const root = document.documentElement;
    root.dataset.cellPlayerMode = 'true';
    root.style.setProperty('--cell-player-mode-video-height', `${videoStageHeight}px`);
    root.style.setProperty('--cell-player-mode-dock-height', `${DOCK_MIN_HEIGHT_PX}px`);
  }

  private clearPlayerModeBounds(): void {
    const root = document.documentElement;
    delete root.dataset.cellPlayerMode;
    root.style.removeProperty('--cell-player-mode-video-height');
    root.style.removeProperty('--cell-player-mode-dock-height');
  }

  private handlePlayerModeToggle(active: boolean): void {
    this.isPlayerModeActive = active;
    if (!active) {
      if (this.playerModeResizeHandler) {
        window.removeEventListener('resize', this.playerModeResizeHandler);
        this.playerModeResizeHandler = null;
      }
      this.playerModeHost?.restore();
      this.playerModeHost = null;
      this.clearPlayerModeBounds();
      return;
    }

    this.playerModeHost?.restore();
    this.playerModeHost = createPlayerModeHostController(this.video, this.container);
    const updateLayout = (): void => {
      const videoStageHeight = this.getPlayerModeVideoStageHeight();
      this.playerModeHost?.update(videoStageHeight);
      this.setPlayerModeBounds(videoStageHeight);
    };
    updateLayout();
    const onResize = (): void => {
      updateLayout();
    };
    this.playerModeResizeHandler = onResize;
    window.addEventListener('resize', onResize);
  }

  /** Toggle Player Mode via keyboard shortcut 'g'. Delegates to the mounted
   *  SubtitlePanels ref, which flips playerMode state and calls
   *  onTogglePlayerMode → handlePlayerModeToggle. */
  togglePlayerMode(): void {
    this.mount.togglePlayerMode();
  }

  /** Current active cue indices from the engine. */
  getActiveIndices(): { target: number; native: number } {
    return this.engine.getActiveIndices();
  }

  enableDictionaryPopup(
    triggerMode: TriggerMode,
    onLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect, highlightTarget: HTMLSpanElement) => void,
    onCancel: (requestId: string) => void,
    onClear?: () => void,
  ): void {
    this.engine.enableDictionaryPopup({ triggerMode, onLookup, onCancel, onClear });
  }

  disableDictionaryPopup(): void {
    this.engine.disableDictionaryPopup();
  }

  setDictionaryPopupTriggerMode(mode: TriggerMode): void {
    this.engine.setDictionaryPopupTriggerMode(mode);
  }

  isDictionaryPopupEnabled(): boolean {
    return this.engine.isDictionaryPopupEnabled();
  }

  attachOverflowButtons(_buttons: { panelToggle?: HTMLElement; importButton?: HTMLElement; managerIcon?: HTMLElement }): void {
    // The React UI uses the manager panel for import/manager; no overflow slot needed.
  }

  destroy(): void {
    if (this.playerModeResizeHandler) {
      window.removeEventListener('resize', this.playerModeResizeHandler);
      this.playerModeResizeHandler = null;
    }
    this.playerModeHost?.restore();
    this.playerModeHost = null;
    this.clearPlayerModeBounds();
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.yOffsetPersistTimer) {
      clearTimeout(this.yOffsetPersistTimer);
      this.yOffsetPersistTimer = null;
    }
    this.video.removeEventListener('play', this.onVideoPlay);
    this.video.removeEventListener('pause', this.onVideoPause);
    this.mount.unmount();
  }
}
