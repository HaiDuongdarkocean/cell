import type { SrtCue, NavClusterSettings, SubtitleBlockSettings, Settings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { StudyMode, StudyModeAdvancedSettings } from '@/entities/studyMode';
import {
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_NAV_CLUSTER_SETTINGS,
} from '@/shared/config/config';
import { mountSubtitle, type MountSubtitleResult, type ManagerState, type OffsetState } from './mountSubtitle';
import { StudyModePlaybackController, type PlaybackAction } from '@/features/studyModes/lib/studyModePlaybackController';
import type { SubtitlePanelItem } from './subtitlePanelModel';
import type { AppearanceState } from './SubtitleManagerPanel';
import { SubtitleCueEngine, type SubtitleCueEngineUpdate, type CardCreatorAction, type SubtitleCueEngineTokenizeOptions } from './subtitleCueEngine';
import type { TriggerMode, LookupRequest } from '@/features/dictionaryPopup/types';
import { clampOffsetMs } from '@/features/subtitle/logic/subtitleOffset';
import { mergeCuesForPanel } from '@/features/subtitle/logic/subtitleMerge';
import { cuesToSrt } from '@/features/subtitle/logic/cuesToSrt';
import type { SubtitleSearchResult } from '@/features/subtitle/logic/subtitleSearchTypes';
import { resolvePlayerModeLayout, resolveVideoAspectRatio, DOCK_MIN_HEIGHT_PX } from '@/features/subtitle/logic/playerModeGeometry';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import type { SubtitleApiKey } from '@/entities/settings';
import { createPlayerModeHostController, type PlayerModeHostController } from './playerModeHost';

import type { ICON_CATALOG } from '@/shared/icons';

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
  /** Storage key for subtitle offset — site origin (not full URL) so the
   *  latency persists across episodes on SPAs like kisskh where each episode
   *  has a different URL but the same origin. ADR-019 amendment (per-site). */
  private readonly offsetKey: string;
  private destroyed = false;
  private readonly onGenerateNative: () => void;
  private readonly onCardCreatorAction: (action: CardCreatorAction) => void;
  private offsetMs = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private yOffsetPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private isPlaying = false;
  private repeatActive = false;
  private repeatIcon: IconCatalogKey = 'navRepeat';
  private repeatLabel = 'Repeat current sentence';
  private managerTargetItems: SubtitlePanelItem[] = [];
  private managerNativeItems: SubtitlePanelItem[] = [];
  private managerTargetActiveIndex = 0;
  private managerNativeActiveIndex = 0;
  private generateNativeEnabled = true;
  private stylePersistTimer: ReturnType<typeof setTimeout> | null = null;
  private blockPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private clusterPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private previewTextPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private previewTargetText = 'This is how the target subtitle will look.';
  private previewNativeText = 'This is how the native subtitle will look.';
  private hasSearchKeys = false;
  private searchApiKeys: readonly SubtitleApiKey[] = [];
  private onApiKeysChangeCallback: ((keys: SubtitleApiKey[]) => void) | null = null;

  private playerModeResizeHandler: (() => void) | null = null;
  /** Study mode playback state machine. Null when no study mode is active. */
  private studyModePlayback: StudyModePlaybackController | null = null;
  /** Last cue index seen by the study mode state machine (for enter/exit detection). */
  private lastStudyModeCueIndex = -1;

  /** Called when the user selects a subtitle track from the manager panel. */
  public onManagerSelect?: (role: 'target' | 'native', index: number) => void;
  /** Called when the user imports a subtitle file. */
  public onImportFiles?: (role: 'target' | 'native', files: FileList) => void;
  /** Called when the user toggles the Chrome side panel. */
  public onToggleSidePanel?: () => void;
  /** Called when the user clicks the OCR toggle button in the toolbar. */
  public onToggleOcr?: () => void;
  /** Whether OCR is currently enabled (drives toolbar button active state). */
  public ocrEnabled = false;
  /** Called when active cue indices change (for subtitle tokenize rendering). */
  public onCuesUpdated?: () => void;
  /** Called when the user selects a search result to download + load. Delegates
   *  to contentScriptController which handles the actual fetch + loadBilingualCues. */
  public onSearchResultSelect?: (result: SubtitleSearchResult, role: 'target' | 'native') => void;
  /** Called when the user clicks the download icon on a track item. */
  public onDownloadItem?: (role: 'target' | 'native', index: number) => void;
  /** Called when the user toggles hide/show for a section's subtitle in the overlay. */
  public onHideSection?: (role: 'target' | 'native') => void;
  /** Called when the user toggles hide/show for both subtitles in the overlay. */
  public onHideBoth?: () => void;

  /** Whether target subtitle is currently hidden from the overlay. */
  private targetHidden = false;
  /** Whether native subtitle is currently hidden from the overlay. */
  private nativeHidden = false;

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
    this.offsetKey = this.resolveOffsetKey(this.url);
    this.onCardCreatorAction = onCardCreatorAction;
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
      onToggleOcr: () => this.onToggleOcr?.(),
      ocrEnabled: this.ocrEnabled,
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
    video.addEventListener('timeupdate', this.onVideoTimeUpdate);
  }

  /** Resolve the storage key for subtitle offset. Prefer the site origin so
   *  latency persists across episodes on SPAs (kisskh) where the URL changes
   *  per episode but the origin stays constant. Fall back to the full URL when
   *  the origin cannot be parsed (e.g. non-standard schemes). */
  private resolveOffsetKey(url: string): string {
    try {
      const origin = new URL(url).origin;
      return origin === 'null' ? url : origin;
    } catch {
      return url;
    }
  }

  private loadPersistedOffset(): void {
    try {
      loadSettings().then((settings) => {
        if (this.destroyed) return;
        const persisted = settings.subtitleOffset?.[this.offsetKey];
        if (typeof persisted === 'number' && !Number.isNaN(persisted)) {
          this.offsetMs = clampOffsetMs(persisted);
          // Apply the loaded offset to the already-constructed mount + engine.
          // The constructor builds these with offsetMs=0; the async load
          // resolves later, so by now mount/engine exist. Without this, the
          // OffsetLayer display + manager panel show 0 after a controller
          // re-init (SPA episode switch) even though the engine's offset
          // provider would eventually pick up the new value.
          this.mount.setOffset(this.buildOffsetState());
          this.mount.setManager(this.buildManagerState());
          this.engine.onTimeUpdate();
        }
        if (typeof settings.subtitlePreviewTargetText === 'string' && settings.subtitlePreviewTargetText) {
          this.previewTargetText = settings.subtitlePreviewTargetText;
        }
        if (typeof settings.subtitlePreviewNativeText === 'string' && settings.subtitlePreviewNativeText) {
          this.previewNativeText = settings.subtitlePreviewNativeText;
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
      // Read-modify-write the subtitleOffset map: saveSettings shallow-merges
      // top-level keys, so passing `{ [key]: ms }` alone would wipe every
      // other site's persisted offset. Merge with the existing map first.
      loadSettings()
        .then((s) => {
          if (this.destroyed) return;
          const merged = { ...(s.subtitleOffset ?? {}), [this.offsetKey]: this.offsetMs };
          saveSettings({ [OFFSET_SETTINGS_KEY]: merged } as Partial<Settings>).catch(() => undefined);
        })
        .catch(() => undefined);
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
      offsetMs: this.offsetMs,
      appearance: this.buildAppearanceState(),
      hasSearchKeys: this.hasSearchKeys,
      apiKeys: this.searchApiKeys,
      onApiKeysChange: (keys) => this.onApiKeysChangeCallback?.(keys),
      onSearchResultSelect: (result, role) => this.onSearchResultSelect?.(result, role),
      onDownload: (role, index) => this.handleDownloadItem(role, index),
      onHideSection: (role) => this.handleHideSection(role),
      onHideBoth: () => this.handleHideBoth(),
      targetHidden: this.targetHidden,
      nativeHidden: this.nativeHidden,
      bothHidden: this.targetHidden && this.nativeHidden,
    };
  }

  private buildAppearanceState(): AppearanceState {
    return {
      targetStyle: this.engine.getTargetStyle(),
      nativeStyle: this.engine.getNativeStyle(),
      blockSettings: this.engine.getBlockSettings(),
      clusterSettings: this.engine.getClusterSettings(),
      defaultTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
      defaultNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
      previewTargetText: this.previewTargetText,
      previewNativeText: this.previewNativeText,
      onStyleChange: (role, partial) => this.handleStyleChange(role, partial),
      onBlockSettingsChange: (partial) => this.handleBlockSettingsChange(partial),
      onClusterSettingsChange: (partial) => this.handleClusterSettingsChange(partial),
      onResetStyle: (role) => this.handleResetStyle(role),
      onPreviewTextChange: (role, text) => this.handlePreviewTextChange(role, text),
    };
  }

  /** Download a subtitle track item as SRT file. Gets cues for the role,
   *  serializes to SRT, and triggers a browser download. */
  private handleDownloadItem(role: 'target' | 'native', _index: number): void {
    const cues = role === 'target' ? this.engine.getTargetCues() : this.engine.getNativeCues();
    if (cues.length === 0) return;
    const srt = cuesToSrt(cues);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${role}-subtitle.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Toggle hide/show for a section's subtitle in the overlay. */
  private handleHideSection(role: 'target' | 'native'): void {
    if (role === 'target') {
      this.targetHidden = !this.targetHidden;
      const style = this.engine.getTargetStyle();
      this.engine.updateSettings({ targetStyle: { ...style, visible: !this.targetHidden } });
    } else {
      this.nativeHidden = !this.nativeHidden;
      const style = this.engine.getNativeStyle();
      this.engine.updateSettings({ nativeStyle: { ...style, visible: !this.nativeHidden } });
    }
    this.updateStylesFromEngine();
    this.mount.setManager(this.buildManagerState());
  }

  /** Toggle hide/show for both target + native subtitles in the overlay. */
  private handleHideBoth(): void {
    const bothHidden = this.targetHidden && this.nativeHidden;
    if (bothHidden) {
      // Show both
      this.targetHidden = false;
      this.nativeHidden = false;
    } else {
      // Hide both
      this.targetHidden = true;
      this.nativeHidden = true;
    }
    const targetStyle = this.engine.getTargetStyle();
    const nativeStyle = this.engine.getNativeStyle();
    this.engine.updateSettings({
      targetStyle: { ...targetStyle, visible: !this.targetHidden },
      nativeStyle: { ...nativeStyle, visible: !this.nativeHidden },
    });
    this.updateStylesFromEngine();
    this.mount.setManager(this.buildManagerState());
  }

  /** Merge partial style with current engine style, apply to engine, debounced persist. */
  private handleStyleChange(role: 'target' | 'native', partial: Partial<OverlayStyleConfig>): void {
    const current = role === 'target' ? this.engine.getTargetStyle() : this.engine.getNativeStyle();
    const merged = { ...current, ...partial };
    if (role === 'target') this.engine.updateSettings({ targetStyle: merged });
    else this.engine.updateSettings({ nativeStyle: merged });
    this.updateStylesFromEngine();
    this.mount.setManager(this.buildManagerState());

    if (this.stylePersistTimer) clearTimeout(this.stylePersistTimer);
    this.stylePersistTimer = setTimeout(() => {
      const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
      saveSettings({ [key]: merged } as Partial<Settings>).catch(() => undefined);
      this.stylePersistTimer = null;
    }, OFFSET_PERSIST_DEBOUNCE_MS);
  }

  private handleBlockSettingsChange(partial: Partial<SubtitleBlockSettings>): void {
    const current = this.engine.getBlockSettings();
    const merged = { ...current, ...partial };
    this.engine.updateSettings({ blockSettings: merged });
    if (partial.yOffsetPercent !== undefined) {
      this.mount.setYOffsetPercent(partial.yOffsetPercent);
    }
    this.updateStylesFromEngine();
    this.mount.setManager(this.buildManagerState());

    if (this.blockPersistTimer) clearTimeout(this.blockPersistTimer);
    this.blockPersistTimer = setTimeout(() => {
      saveSettings({ subtitleBlockSettings: merged } as Partial<Settings>).catch(() => undefined);
      this.blockPersistTimer = null;
    }, OFFSET_PERSIST_DEBOUNCE_MS);
  }

  private handleClusterSettingsChange(partial: Partial<NavClusterSettings>): void {
    const current = this.engine.getClusterSettings();
    const merged = { ...current, ...partial };
    this.engine.updateSettings({ clusterSettings: merged });
    this.updateStylesFromEngine();
    this.mount.setManager(this.buildManagerState());

    if (this.clusterPersistTimer) clearTimeout(this.clusterPersistTimer);
    this.clusterPersistTimer = setTimeout(() => {
      saveSettings({ navClusterSettings: merged } as Partial<Settings>).catch(() => undefined);
      this.clusterPersistTimer = null;
    }, OFFSET_PERSIST_DEBOUNCE_MS);
  }

  private handleResetStyle(role: 'target' | 'native'): void {
    const defaults = role === 'target' ? DEFAULT_OVERLAY_STYLE_TARGET : DEFAULT_OVERLAY_STYLE_NATIVE;
    if (role === 'target') this.engine.updateSettings({ targetStyle: defaults });
    else this.engine.updateSettings({ nativeStyle: defaults });
    this.updateStylesFromEngine();
    this.mount.setManager(this.buildManagerState());

    const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
    saveSettings({ [key]: defaults } as Partial<Settings>).catch(() => undefined);
  }

  private handlePreviewTextChange(role: 'target' | 'native', text: string): void {
    if (role === 'target') this.previewTargetText = text;
    else this.previewNativeText = text;
    this.mount.setManager(this.buildManagerState());

    if (this.previewTextPersistTimer) clearTimeout(this.previewTextPersistTimer);
    this.previewTextPersistTimer = setTimeout(() => {
      const key = role === 'target' ? 'subtitlePreviewTargetText' : 'subtitlePreviewNativeText';
      saveSettings({ [key]: text } as Partial<Settings>).catch(() => undefined);
      this.previewTextPersistTimer = null;
    }, OFFSET_PERSIST_DEBOUNCE_MS);
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
    input.accept = '.srt,.vtt,.ass,.ssa';
    input.multiple = true;
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
  private readonly onVideoPlay = (): void => {
    this.setIsPlaying(true);
    const actions = this.studyModePlayback?.continue();
    if (actions) this.applyPlaybackActions(actions);
  };
  private readonly onVideoPause = (): void => this.setIsPlaying(false);
  private readonly onVideoTimeUpdate = (): void => {
    this.engine.onTimeUpdate();
    this.mount.setCurrentTimeMs(this.video.currentTime * 1000);
    this.onStudyModeTimeUpdate();
  };

  private applyGenerateNativeEnabled(enabled: boolean): void {
    this.generateNativeEnabled = enabled;
    this.mount.setGenerateNativeEnabled(enabled);
  }

  /** Update OCR enabled state → toolbar button active state. */
  setOcrEnabled(enabled: boolean): void {
    this.ocrEnabled = enabled;
    this.mount.setOcrEnabled(enabled);
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
    if (typeof arg === 'boolean') return;
    this.engine.loadCues([...arg]);
    this.engine.onTimeUpdate();
    this.syncFromEngine();
    this.studyModePlayback?.setCues(this.engine.getTargetCues(), this.getOffsetMs());
    this.onStudyModeTimeUpdate();
  }

  loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
    this.engine.loadBilingualCues(targetCues, nativeCues);
    this.engine.onTimeUpdate();
    this.syncFromEngine();
    // Sync CueList in Player Mode with merged bilingual cues.
    this.mount.setCues(mergeCuesForPanel(targetCues, nativeCues));
    this.studyModePlayback?.setCues(this.engine.getTargetCues(), this.getOffsetMs());
    this.onStudyModeTimeUpdate();
  }

  clearCues(): void {
    this.engine.clearCues();
    this.syncFromEngine();
    this.mount.setCues([]);
    this.studyModePlayback?.setCues([], this.getOffsetMs());
    this.lastStudyModeCueIndex = -1;
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
    // Refresh manager state so the panel's offsetMs prop stays current —
    // the panel mounts fresh on each open and reads this prop as its initial
    // Latency value. Without this, reopening after a change shows the stale
    // pre-change value.
    this.mount.setManager(this.buildManagerState());
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

  /** Force re-render of the manager panel with current state (e.g. after
   *  setting callbacks that were undefined at construction time). */
  refreshManagerState(): void {
    this.mount.setManager(this.buildManagerState());
  }

  /** Sync hidden state from engine style.visible — called by contentScriptController
   *  when overlay visibility is toggled externally (shortcut, showOverlay, etc.).
   *  Keeps the manager panel's hide buttons in sync with the actual overlay state. */
  syncHiddenState(): void {
    this.targetHidden = !this.engine.getTargetStyle().visible;
    this.nativeHidden = !this.engine.getNativeStyle().visible;
    this.mount.setManager(this.buildManagerState());
  }

  /** Apply a study mode to the current playback.
   *  Drives the study-mode playback state machine for per-cue step sequencing.
   *  removeBracketed is applied to overlay rendering. */
  applyStudyMode(activeMode: StudyMode, advanced: StudyModeAdvancedSettings): void {
    if (this.destroyed) return;
    this.studyModePlayback = new StudyModePlaybackController(
      activeMode,
      advanced,
      this.engine.getTargetCues(),
      this.getOffsetMs(),
    );
    this.lastStudyModeCueIndex = -1;
    this.mount.setRemoveBracketed(advanced.removeBracketed);

    // Apply first step immediately if a cue is currently active.
    this.onStudyModeTimeUpdate();
  }

  /** Drive the study-mode state machine on every time update. */
  private onStudyModeTimeUpdate(): void {
    if (!this.studyModePlayback) return;

    const indices = this.engine.getActiveIndices();
    const targetIndex = indices.target;
    const cues = this.engine.getTargetCues();
    if (targetIndex !== this.lastStudyModeCueIndex && targetIndex >= 0 && cues[targetIndex]) {
      this.lastStudyModeCueIndex = targetIndex;
      const actions = this.studyModePlayback.enterCue(cues[targetIndex], targetIndex);
      this.applyPlaybackActions(actions);
    }

    const timeMs = this.video.currentTime * 1000;
    const actions = this.studyModePlayback.onTimeUpdate(timeMs);
    this.applyPlaybackActions(actions);
  }

  private applyPlaybackActions(actions: readonly PlaybackAction[]): void {
    for (const action of actions) {
      switch (action.type) {
        case 'setSubtitle': {
          this.targetHidden = action.subtitle === 'none' || action.subtitle === 'native';
          this.nativeHidden = action.subtitle === 'none' || action.subtitle === 'target';
          this.engine.updateSettings({
            targetStyle: { ...this.engine.getTargetStyle(), visible: !this.targetHidden },
            nativeStyle: { ...this.engine.getNativeStyle(), visible: !this.nativeHidden },
          });
          this.updateStylesFromEngine();
          this.mount.setManager(this.buildManagerState());
          break;
        }
        case 'setSpeed':
          this.video.playbackRate = action.speed;
          break;
        case 'seek':
          this.video.currentTime = (action.timeMs - this.getOffsetMs()) / 1000;
          break;
        case 'pause':
          this.video.pause();
          break;
        case 'play':
          void this.video.play();
          break;
      }
    }
  }

  // === Subtitle manager panel (legacy managerPanel replacement) ===

  updateManagerItems(role: 'target' | 'native', items: SubtitlePanelItem[], activeIndex: number): void {
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

  /** Update whether subtitle search API keys are configured. Controls search UI
   *  availability in the manager panel. Triggers re-render so the panel reflects
   *  the new state immediately. */
  setHasSearchKeys(has: boolean): void {
    this.hasSearchKeys = has;
    this.mount.setManager(this.buildManagerState());
  }

  /** Update the list of subtitle search API keys (for inline ApiKeyManager
   *  in the search view). Triggers re-render so the panel reflects the new
   *  keys immediately. */
  setSearchApiKeys(keys: readonly SubtitleApiKey[]): void {
    this.searchApiKeys = keys;
    this.mount.setManager(this.buildManagerState());
  }

  /** Store the callback that persists API key changes to settings storage.
   *  Called by contentScriptController during wiring. */
  onApiKeysChange(callback: (keys: SubtitleApiKey[]) => void): void {
    this.onApiKeysChangeCallback = callback;
    this.mount.setManager(this.buildManagerState());
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

  /** Toggle Split View — CueList panel beside video container (page thường only). */
  toggleSplitView(): void {
    this.mount.toggleSplitView();
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
    this.destroyed = true;
    if (this.playerModeResizeHandler) {
      window.removeEventListener('resize', this.playerModeResizeHandler);
      this.playerModeResizeHandler = null;
    }
    this.playerModeHost?.restore();
    this.playerModeHost = null;
    this.clearPlayerModeBounds();
    if (this.persistTimer) { clearTimeout(this.persistTimer); this.persistTimer = null; }
    if (this.yOffsetPersistTimer) { clearTimeout(this.yOffsetPersistTimer); this.yOffsetPersistTimer = null; }
    if (this.stylePersistTimer) { clearTimeout(this.stylePersistTimer); this.stylePersistTimer = null; }
    if (this.blockPersistTimer) { clearTimeout(this.blockPersistTimer); this.blockPersistTimer = null; }
    if (this.clusterPersistTimer) { clearTimeout(this.clusterPersistTimer); this.clusterPersistTimer = null; }
    if (this.previewTextPersistTimer) { clearTimeout(this.previewTextPersistTimer); this.previewTextPersistTimer = null; }
    this.video.removeEventListener('play', this.onVideoPlay);
    this.video.removeEventListener('pause', this.onVideoPause);
    this.video.removeEventListener('timeupdate', this.onVideoTimeUpdate);
    this.mount.unmount();
  }
}
