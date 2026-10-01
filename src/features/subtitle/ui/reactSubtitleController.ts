import type { SrtCue, NavClusterSettings, SubtitleBlockSettings, Settings, BilingualCue } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { CueBandProbe, StudyMode, StudyModeAdvancedSettings, PlaybackSpeed } from '@/entities/studyMode';
import {
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_NAV_CLUSTER_SETTINGS,
} from '@/shared/config/config';
import { mountSubtitle, type MountSubtitleResult, type ManagerState } from './mountSubtitle';
import { SubtitleStyleController } from './subtitleStyleController';
import {
  SubtitleStudyModeController,
  type SubtitleStudyModeTimeState,
} from '@/features/studyModes';
import type { PlaybackAction, UnknownCueProbe } from '@/features/studyModes';
import type { SubtitlePanelItem } from './subtitlePanelModel';
import { SubtitleCueEngine, type SubtitleCueEngineUpdate, type CardCreatorAction, type SubtitleCueEngineTokenizeOptions } from './subtitleCueEngine';
import type { TriggerMode, LookupRequest } from '@/entities/dictionary';
import { clampOffsetMs } from '@/features/subtitle/logic/subtitleOffset';
import { mergeCuesForPanel } from '@/features/subtitle/logic/subtitleMerge';
import { cuesToSrt } from '@/features/subtitle/logic/cuesToSrt';
import type { SubtitleSearchResult } from '@/entities/subtitle/searchTypes';
import { resolvePlayerModeLayout, resolveVideoAspectRatio, DOCK_MIN_HEIGHT_PX } from '@/features/subtitle/logic/playerModeGeometry';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import type { SubtitleApiKey } from '@/entities/settings';
import { pauseVideo, playVideo, seekToCue } from '@/shared/lib/dom/netflixPlayback';
import { createPlayerModeHostController, type PlayerModeHostController } from './playerModeHost';
import { practiceModeFromStudyModeId, setSubtitlePracticeMode } from '@/features/studyModes';
import type { SubtitlePracticeMode } from '@/features/studyModes';
import { t } from '@/shared/i18n';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { CondenseAudioStartPayload, CondenseAudioStartResult } from '@/entities/message';
import type { MessageResponse } from '@/entities/message';

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
  private isPlaying = false;
  private repeatActive = false;
  private repeatIcon: IconCatalogKey = 'navRepeat';
  private repeatLabel = t('player.nav.repeat');
  private managerTargetItems: SubtitlePanelItem[] = [];
  private managerNativeItems: SubtitlePanelItem[] = [];
  private managerTargetActiveIndex = 0;
  private managerNativeActiveIndex = 0;
  private generateNativeEnabled = true;
  private hasSearchKeys = false;
  private searchApiKeys: readonly SubtitleApiKey[] = [];
  private panelCues: BilingualCue[] = [];
  private onApiKeysChangeCallback: ((keys: SubtitleApiKey[]) => void) | null = null;
  private practiceMode: SubtitlePracticeMode = 'off';

  /** Style/manager state lives in a dedicated controller. */
  private styleController: SubtitleStyleController | undefined;

  private playerModeResizeHandler: (() => void) | null = null;
  /** Study mode playback coordinator. Null when no study mode is active. */
  private studyMode: SubtitleStudyModeController = new SubtitleStudyModeController();
  /** Player state captured when a study mode takes over; restored when the
   *  mode deactivates (back to 'normal'). */
  private studyBaseline: { playbackRate: number; targetHidden: boolean; nativeHidden: boolean } | null = null;
  /** Speed the user picked via SpeedPill / side panel. Once set it wins over
   *  study-mode per-step setSpeed actions so a cue transition can't reset it. */
  private userSpeed: PlaybackSpeed | null = null;

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
  /** Called when the study-mode machine auto-pauses on an unknown word. */
  public onAutoPause?: (term: string, cueIndex: number, termOffset: number) => void;
  /** Called when playback resumes after an auto-pause (popup-close hook). */
  public onAutoResume?: () => void;
  private autoPausePending = false;

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
        onStyleUpdated: () => this.styleController?.updateStylesFromEngine(),
        onPlayPause: (playing) => this.setIsPlaying(playing),
        onGenerateNativeEnabled: (enabled) => this.applyGenerateNativeEnabled(enabled),
      },
    );

    this.isPlaying = !video.paused;
    video.addEventListener('play', this.onVideoPlay);
    video.addEventListener('pause', this.onVideoPause);
    video.addEventListener('seeking', this.onVideoSeeking);

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
      onDragReposition: (y) => this.styleController?.handleDragReposition(y),
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
      onPracticeModeChange: (mode: SubtitlePracticeMode) => { void setSubtitlePracticeMode(mode); },
      onPlaybackSpeedChange: (speed: PlaybackSpeed) => this.setUserPlaybackSpeed(speed),
      onPreviousCue: (cue: BilingualCue) => this.handlePreviousCue(cue),
      onReplayCue: (cue: BilingualCue) => this.handleReplayCue(cue),
      onContinueCue: (cue: BilingualCue) => this.handleContinueCue(cue),
    });

    this.styleController = new SubtitleStyleController({
      engine: this.engine,
      mount: this.mount,
      getOffsetMs: () => this.getOffsetMs(),
      onOffsetChange: (ms) => this.setOffsetMs(ms),
      onManagerUpdate: () => this.mount.setManager(this.buildManagerState()),
    });

    this.mount.setManager(this.buildManagerState());
    this.mount.setOffset(this.styleController.buildOffsetState());

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
      void loadSettings().then((settings) => {
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
          this.mount.setOffset(this.styleController!.buildOffsetState());
          this.mount.setManager(this.buildManagerState());
          this.engine.onTimeUpdate();
        }
        if (typeof settings.subtitlePreviewTargetText === 'string' && settings.subtitlePreviewTargetText) {
          this.styleController?.setPreviewText('target', settings.subtitlePreviewTargetText);
        }
        if (typeof settings.subtitlePreviewNativeText === 'string' && settings.subtitlePreviewNativeText) {
          this.styleController?.setPreviewText('native', settings.subtitlePreviewNativeText);
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

  private buildManagerState(): ManagerState {
    const styleController = this.styleController;
    if (!styleController) throw new Error('style controller not initialized');
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
      appearance: styleController.buildAppearanceState(),
      hasSearchKeys: this.hasSearchKeys,
      apiKeys: this.searchApiKeys,
      onApiKeysChange: (keys) => this.onApiKeysChangeCallback?.(keys),
      onSearchResultSelect: (result, role) => this.onSearchResultSelect?.(result, role),
      onDownload: (role, index) => this.handleDownloadItem(role, index),
      onHideSection: (role) => styleController.handleHideSection(role),
      onHideBoth: () => styleController.handleHideBoth(),
      targetHidden: styleController.getTargetHidden(),
      nativeHidden: styleController.getNativeHidden(),
      bothHidden: styleController.getTargetHidden() && styleController.getNativeHidden(),
      onCondenseAudio: () => this.handleCondenseAudio(),
      condenseAudioEnabled: this.condenseCueRanges().length > 0,
    };
  }

  private condenseCueRanges(): { startMs: number; endMs: number }[] {
    const cues = this.engine.getTargetCues();
    const source = cues.length > 0 ? cues : this.engine.getNativeCues();
    return source.map((c) => ({ startMs: c.start, endMs: c.end }));
  }

  private handleCondenseAudio(): void {
    const ranges = this.condenseCueRanges();
    if (ranges.length === 0) return;
    const durationMs = Number.isFinite(this.video.duration) ? this.video.duration * 1000 : 0;
    const payload: CondenseAudioStartPayload = {
      title: document.title || 'condensed-audio',
      leg: 'record',
      source: { kind: 'stream', pageKey: `${location.origin}${location.pathname}` },
      ranges,
      durationMs,
    };
    void sendMessage<MessageResponse<CondenseAudioStartResult>>({
      type: MESSAGE_TYPES.CONDENSE_AUDIO_START,
      payload,
    }).then((res) => {
      if (res && res.success === false) {
        this.mount.addToast(t('condensedAudio.trigger.failed'), 'error');
      }
    });
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

  private setIsPlaying(playing: boolean): void {
    this.isPlaying = playing;
    this.mount.setIsPlaying(playing);
  }

  // SSOT: video element là nguồn sự thật cho play/pause state. Listener này
  // bắt mọi nguồn (keyboard shortcut, host UI click, programmatic) → NavCluster
  // icon luôn sync. Trước đó chỉ engine.handlePlayPause callback mới update.
  private readonly onVideoPlay = (): void => {
    this.setIsPlaying(true);
    const actions = this.studyMode.continue();
    if (actions.length) this.applyPlaybackActions(actions);
  };
  private readonly onVideoPause = (): void => this.setIsPlaying(false);
  private readonly onVideoSeeking = (): void => {
    this.studyMode.onSeeking(this.video.currentTime * 1000);
    this.syncHeldCue();
  };
  private readonly onVideoTimeUpdate = (): void => {
    this.engine.onTimeUpdate();
    this.mount.setCurrentTimeMs(this.video.currentTime * 1000);
    this.syncStudyMode();
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
    seekToCue(this.video, { start: timeMs }, this.offsetMs);
  }

  private handlePreviousCue(cue: BilingualCue): void {
    const textCues = this.panelCues.filter((c) => c.targetText.trim().length > 0);
    const index = textCues.findIndex((c) => c.index === cue.index && c.start === cue.start);
    const prev = index > 0 ? textCues[index - 1] : undefined;
    if (prev) {
      this.video.currentTime = (prev.start - this.offsetMs) / 1000;
    }
    void this.video.play().catch(() => undefined);
  }

  private handleReplayCue(cue: BilingualCue): void {
    this.video.currentTime = (cue.start - this.offsetMs) / 1000;
    void this.video.play().catch(() => undefined);
  }

  private handleContinueCue(cue: BilingualCue): void {
    const textCues = this.panelCues.filter((c) => c.targetText.trim().length > 0);
    const index = textCues.findIndex((c) => c.index === cue.index && c.start === cue.start);
    const next = index >= 0 ? textCues[index + 1] : undefined;
    if (next) {
      this.video.currentTime = (next.start - this.offsetMs) / 1000;
    }
    void this.video.play().catch(() => undefined);
  }

  setOffsetProvider(_provider: () => number): void {
    // The React controller owns the offset provider internally.
  }

  updateSettings(update: SubtitleCueEngineUpdate): void {
    if (this.studyMode.isActive) {
      const { targetStyle, nativeStyle } = update;
      update = {
        ...update,
        ...(targetStyle && { targetStyle: { ...targetStyle, visible: this.engine.getTargetStyle().visible } }),
        ...(nativeStyle && { nativeStyle: { ...nativeStyle, visible: this.engine.getNativeStyle().visible } }),
      };
    }
    this.engine.updateSettings(update);
    this.styleController?.updateStylesFromEngine();
  }

  loadCues(cues: readonly SrtCue[]): void;
  loadCues(hasSubtitle: boolean): void;
  loadCues(arg: readonly SrtCue[] | boolean): void {
    if (typeof arg === 'boolean') return;
    this.engine.loadCues([...arg]);
    this.engine.onTimeUpdate();
    this.syncFromEngine();
    this.studyMode.setCues(this.engine.getTargetCues(), this.getOffsetMs());
    this.syncStudyMode();
  }

  loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
    this.engine.loadBilingualCues(targetCues, nativeCues);
    this.engine.onTimeUpdate();
    this.syncFromEngine();
    // Sync CueList in Player Mode with merged bilingual cues.
    this.panelCues = mergeCuesForPanel(targetCues, nativeCues).filter(
      (c) => c.targetText.trim().length > 0 || c.nativeText.trim().length > 0,
    );
    this.mount.setCues(this.panelCues);
    this.studyMode.setCues(this.engine.getTargetCues(), this.getOffsetMs());
    this.syncStudyMode();
  }

  clearCues(): void {
    this.engine.clearCues();
    this.syncFromEngine();
    this.panelCues = [];
    this.mount.setCues([]);
    this.studyMode.clearCues(this.getOffsetMs());
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

  getTargetStyle(): OverlayStyleConfig {
    return this.engine.getTargetStyle();
  }

  getNativeStyle(): OverlayStyleConfig {
    return this.engine.getNativeStyle();
  }

  isStudyModeActive(): boolean {
    return this.studyMode.isActive;
  }

  setOffsetMs(ms: number): void {
    this.offsetMs = clampOffsetMs(ms);
    this.persistOffset();
    this.mount.setOffset(this.styleController!.buildOffsetState());
    // Refresh manager state so the panel's offsetMs prop stays current —
    // the panel mounts fresh on each open and reads this prop as its initial
    // Latency value. Without this, reopening after a change shows the stale
    // pre-change value.
    this.mount.setManager(this.buildManagerState());
    // Re-render current cue with new offset.
    this.engine.onTimeUpdate();
    // Keep the study-mode coordinator on the same offset — a stale value makes
    // it classify its own seeks as external user seeks, aborting the chain.
    this.studyMode.setCues(this.engine.getTargetCues(), this.offsetMs);
    this.syncStudyMode();
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
    this.styleController?.setHidden(
      !this.engine.getTargetStyle().visible,
      !this.engine.getNativeStyle().visible,
    );
    this.mount.setManager(this.buildManagerState());
  }

  /** Record + apply a user-picked playback speed (SpeedPill, side panel).
   *  Sticky for the controller's lifetime: subsequent study-mode per-step
   *  setSpeed actions apply this instead of the configured step speed. */
  setUserPlaybackSpeed(speed: PlaybackSpeed): void {
    this.userSpeed = speed;
    this.video.playbackRate = speed;
    this.mount.setPlaybackSpeed(speed);
  }

  /** Apply a study mode to the current playback.
   *  Drives the study-mode playback state machine for per-cue step sequencing.
   *  removeBracketed is applied to overlay rendering. */
  applyStudyMode(activeMode: StudyMode, advanced: StudyModeAdvancedSettings): void {
    if (this.destroyed) return;
    const wasActive = this.studyMode.isActive;
    this.practiceMode = practiceModeFromStudyModeId(activeMode.id);
    this.mount.setPracticeMode(this.practiceMode);
    this.studyMode.applyStudyMode(activeMode, advanced, this.engine.getTargetCues(), this.getOffsetMs());
    this.mount.setRemoveBracketed(advanced.removeBracketed);
    this.engine.setHeldCue(this.studyMode.heldCueIndex);

    if (!wasActive && this.studyMode.isActive) {
      this.studyBaseline = {
        playbackRate: this.video.playbackRate,
        targetHidden: this.styleController?.getTargetHidden() ?? false,
        nativeHidden: this.styleController?.getNativeHidden() ?? false,
      };
    } else if (wasActive && !this.studyMode.isActive && this.studyBaseline) {
      const baseline = this.studyBaseline;
      this.studyBaseline = null;
      const speed = this.userSpeed ?? baseline.playbackRate;
      this.video.playbackRate = speed;
      this.mount.setPlaybackSpeed(speed as PlaybackSpeed);
      this.applySubtitleHidden(baseline.targetHidden, baseline.nativeHidden);
      this.mount.setPanelBlurred(false);
    }

    // Apply first step immediately if a cue is currently active.
    this.syncStudyMode();
    this.syncHeldCue();
    if (!this.studyMode.isActive) {
      this.mount.setPanelBlurred(false);
    }
  }

  /** Drive the study-mode state machine on every time update. */
  private syncStudyMode(): void {
    if (!this.studyMode.isActive) return;

    const { target } = this.engine.getActiveIndices();
    const state: SubtitleStudyModeTimeState = {
      targetIndex: target,
      targetCues: this.engine.getTargetCues(),
      currentTimeMs: this.video.currentTime * 1000,
      isPaused: this.video.paused,
    };
    const actions = this.studyMode.onTimeUpdate(state);
    if (actions.length) this.applyPlaybackActions(actions);
    this.syncHeldCue();
  }

  private syncHeldCue(): void {
    const held = this.studyMode.heldCueIndex;
    this.engine.setHeldCue(held);
    const heldCue = held >= 0 ? this.engine.getTargetCues()[held] : undefined;
    this.mount.setCurrentTimeMs(
      heldCue ? heldCue.start - this.getOffsetMs() : this.video.currentTime * 1000,
    );
  }

  /** Inject the unknown-cue probe used by pauseOnUnknown. Composition root
   *  (contentScriptController) owns the resolver built from cue tokens. */
  setUnknownCueProbe(probe: UnknownCueProbe | null): void {
    this.studyMode.setProbe(probe);
  }

  setBandProbe(probe: CueBandProbe | null): void {
    this.studyMode.setBandProbe(probe);
  }

  private applySubtitleHidden(targetHidden: boolean, nativeHidden: boolean): void {
    this.styleController?.setHidden(targetHidden, nativeHidden);
    this.engine.updateSettings({
      targetStyle: { ...this.engine.getTargetStyle(), visible: !targetHidden },
      nativeStyle: { ...this.engine.getNativeStyle(), visible: !nativeHidden },
    });
    this.styleController?.updateStylesFromEngine();
    this.mount.setManager(this.buildManagerState());
  }

  private applyPlaybackActions(actions: readonly PlaybackAction[]): void {
    // Settle the held-cue pin BEFORE dispatching: on END pause the state
    // machine already set heldCueIndex, so this flips the engine's active
    // index back and emits onCuesUpdated now — before onAutoPause opens the
    // popup, so the cue-change dismiss can't kill the just-opened popup.
    this.syncHeldCue();
    for (const action of actions) {
      switch (action.type) {
        case 'setSubtitle': {
          const targetHidden = action.subtitle === 'none' || action.subtitle === 'native';
          const nativeHidden = action.subtitle === 'none' || action.subtitle === 'target';
          this.applySubtitleHidden(targetHidden, nativeHidden);
          const shouldBlurPanel = this.practiceMode === 'off' && (targetHidden || nativeHidden);
          this.mount.setPanelBlurred(shouldBlurPanel);
          break;
        }
        case 'setSpeed': {
          const speed = action.transient === true
            ? Math.max(action.speed, this.userSpeed ?? action.speed)
            : this.userSpeed ?? action.speed;
          this.video.playbackRate = speed;
          this.mount.setPlaybackSpeed(speed as PlaybackSpeed);
          break;
        }
        case 'seek':
          seekToCue(this.video, { start: action.timeMs }, this.getOffsetMs());
          break;
        case 'pause':
          pauseVideo(this.video);
          break;
        case 'autoPause':
          this.autoPausePending = true;
          this.onAutoPause?.(action.term, action.cueIndex, action.termOffset);
          break;
        case 'play':
          if (this.autoPausePending) {
            this.autoPausePending = false;
            this.onAutoResume?.();
          }
          void playVideo(this.video);
          break;
      }
    }
    this.syncHeldCue();
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
    this.mount.setManager(this.buildManagerState());
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
    this.mount.setTokenize({
      langCode: options.langCode,
      onTokenClick: options.onOpenDictionary,
      onTokenHover: options.onTokenHover,
      onTokenCtrlClick: options.onTokenCtrlClick,
      selection: options.selection,
    });
  }

  disableTokenize(): void {
    this.engine.disableTokenize();
    this.mount.setTokenize(null);
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
      this.onCuesUpdated?.();
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
    this.onCuesUpdated?.();
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
    this.styleController?.destroy();
    if (this.persistTimer) { clearTimeout(this.persistTimer); this.persistTimer = null; }
    this.video.removeEventListener('play', this.onVideoPlay);
    this.video.removeEventListener('pause', this.onVideoPause);
    this.video.removeEventListener('seeking', this.onVideoSeeking);
    this.video.removeEventListener('timeupdate', this.onVideoTimeUpdate);
    this.studyMode.destroy();
    this.engine.setHeldCue(this.studyMode.heldCueIndex);
    this.mount.unmount();
  }
}
