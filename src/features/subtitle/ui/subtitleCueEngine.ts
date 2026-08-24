import { findCurrentLine } from '../logic/subtitleSync';
import type { SrtCue, NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import {
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_NAV_CLUSTER_SETTINGS,
} from '@/shared/config/config';
import { dispatchCuesUpdated, type CuesUpdatedDetail } from '@/features/subtitle/events';
import { prevSentence, nextSentence, seekBy, findActiveCueIndex } from './navClusterActions';
import { seekVideo } from './netflixPlayback';
import type { TriggerMode } from '@/features/dictionaryPopup/types';

export interface SubtitleCueEngineUpdate {
  readonly blockSettings?: Partial<SubtitleBlockSettings>;
  readonly targetStyle?: OverlayStyleConfig;
  readonly nativeStyle?: OverlayStyleConfig;
  readonly clusterSettings?: Partial<NavClusterSettings>;
}

/** Card-creator actions emitted by the overlay tools. */
export type CardCreatorAction = 'quick-update' | 'edit-card' | 'update-current';

/** Legacy nav cluster icon names — kept for cue-engine state mapping. */
export type NavClusterIconName = 'prev' | 'next' | 'repeat' | 'repeatA' | 'repeatB' | 'repeatCancel' | 'rewind' | 'forward' | 'play' | 'pause';

/** Callbacks the engine fires when state changes. */
export interface SubtitleCueEngineCallbacks {
  /** Fired whenever cue lists or active indices change. */
  onCuesUpdated?: (detail: CuesUpdatedDetail) => void;
  /** Fired whenever a setting/style changes and the UI should re-apply. */
  onStyleUpdated?: () => void;
  /** Fired whenever the video play/pause state toggles. */
  onPlayPause?: (isPlaying: boolean) => void;
  /** Fired whenever the generate-native enabled state changes. */
  onGenerateNativeEnabled?: (enabled: boolean) => void;
}

export interface SubtitleCueEngineDictionaryOptions {
  triggerMode: TriggerMode;
  onLookup: (request: import('@/features/dictionaryPopup/types').LookupRequest, requestId: string, anchorRect: DOMRect, highlightTarget: HTMLSpanElement) => void;
  onCancel: (requestId: string) => void;
  onClear?: () => void;
}

export interface SubtitleCueEngineTokenizeOptions {
  langCode: string;
  onOpenDictionary: (term: string, element: HTMLElement, contextSentence: string) => void;
  windowSize?: number;
}

export interface SubtitleCueEngineRepeatState {
  icon: NavClusterIconName;
  label: string;
  active: boolean;
}

/**
 * Logic-only subtitle cue engine.
 *
 * Owns cue/offset/video/time/repeat state and the pure actions that drive it.
 * No DOM access — rendering is the caller's responsibility via callbacks or
 * the `cell:cues:updated` custom event.
 */
export class SubtitleCueEngine {
  private targetCues: SrtCue[] = [];
  private nativeCues: SrtCue[] = [];
  private lastTargetIndex = -1;
  private lastNativeIndex = -1;
  private bilingual = false;
  private blockSettings: SubtitleBlockSettings;
  private targetStyle: OverlayStyleConfig;
  private nativeStyle: OverlayStyleConfig;
  private clusterSettings: NavClusterSettings;
  private getOffsetMs: () => number;
  private callbacks: SubtitleCueEngineCallbacks;
  private loopState: 'idle' | 'a' | 'looping' = 'idle';
  private loopStart = 0;
  private loopEnd = 0;
  private generateNativeEnabled = false;
  private tokenizeOptions: SubtitleCueEngineTokenizeOptions | null = null;
  private tokenizeEnabled = false;
  private dpOptions: SubtitleCueEngineDictionaryOptions | null = null;
  private dpEnabled = false;

  readonly onTimeUpdate = (): void => {
    if (this.loopState === 'looping' && this.video.currentTime >= this.loopEnd) {
      seekVideo(this.video, this.loopStart);
    }
    if (this.targetCues.length === 0 && this.nativeCues.length === 0) return;

    const currentTimeMs = this.video.currentTime * 1000;
    const offsetMs = this.getOffsetMs();

    if (this.bilingual) {
      const targetIndex = findCurrentLine(this.targetCues, currentTimeMs, offsetMs);
      const nativeIndex = findCurrentLine(this.nativeCues, currentTimeMs, offsetMs);
      if (targetIndex === this.lastTargetIndex && nativeIndex === this.lastNativeIndex) return;
      this.lastTargetIndex = targetIndex;
      this.lastNativeIndex = nativeIndex;
      this.emitCuesUpdated();
      return;
    }

    if (this.targetCues.length === 0) return;
    const targetIndex = findCurrentLine(this.targetCues, currentTimeMs, offsetMs);
    if (targetIndex === this.lastTargetIndex) return;
    this.lastTargetIndex = targetIndex;
    this.lastNativeIndex = -1;
    this.emitCuesUpdated();
  };

  constructor(
    private readonly video: HTMLVideoElement,
    blockSettings: SubtitleBlockSettings = DEFAULT_SUBTITLE_BLOCK_SETTINGS,
    targetStyle: OverlayStyleConfig = DEFAULT_OVERLAY_STYLE_TARGET,
    nativeStyle: OverlayStyleConfig = DEFAULT_OVERLAY_STYLE_NATIVE,
    clusterSettings: NavClusterSettings = DEFAULT_NAV_CLUSTER_SETTINGS,
    offsetProvider?: () => number,
    callbacks: SubtitleCueEngineCallbacks = {},
  ) {
    this.blockSettings = this.clampBlockSettings(blockSettings);
    this.targetStyle = targetStyle;
    this.nativeStyle = nativeStyle;
    this.clusterSettings = clusterSettings;
    this.getOffsetMs = offsetProvider ?? (() => 0);
    this.callbacks = callbacks;
  }

  setCallbacks(callbacks: SubtitleCueEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  setOffsetProvider(provider: () => number): void {
    this.getOffsetMs = provider;
  }

  updateSettings(update: SubtitleCueEngineUpdate): void {
    let changed = false;
    if (update.blockSettings) {
      this.blockSettings = this.clampBlockSettings({ ...this.blockSettings, ...update.blockSettings });
      changed = true;
    }
    if (update.targetStyle) {
      this.targetStyle = update.targetStyle;
      changed = true;
    }
    if (update.nativeStyle) {
      this.nativeStyle = update.nativeStyle;
      changed = true;
    }
    if (update.clusterSettings) {
      this.clusterSettings = { ...this.clusterSettings, ...update.clusterSettings };
      changed = true;
    }
    if (changed) {
      this.callbacks.onStyleUpdated?.();
    }
  }

  private clampBlockSettings(settings: SubtitleBlockSettings): SubtitleBlockSettings {
    return {
      yOffsetPercent: Math.min(Math.max(settings.yOffsetPercent, 0), 95),
      globalScale: Math.min(Math.max(settings.globalScale, 0.5), 2),
      bgOpacity: Math.min(Math.max(settings.bgOpacity, 0), 1),
    };
  }

  getBlockSettings(): SubtitleBlockSettings {
    return this.blockSettings;
  }

  updateBlockSettings(partial: Partial<SubtitleBlockSettings>): void {
    this.blockSettings = this.clampBlockSettings({ ...this.blockSettings, ...partial });
  }

  getTargetStyle(): OverlayStyleConfig {
    return this.targetStyle;
  }

  getNativeStyle(): OverlayStyleConfig {
    return this.nativeStyle;
  }

  getClusterSettings(): NavClusterSettings {
    return this.clusterSettings;
  }

  getOffset(): number {
    return this.getOffsetMs();
  }

  loadCues(cues: SrtCue[]): void {
    this.targetCues = cues;
    this.nativeCues = [];
    this.bilingual = false;
    this.lastTargetIndex = -1;
    this.lastNativeIndex = -1;
    this.emitCuesUpdated();
  }

  loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
    if (targetCues.length > 0) this.targetCues = [...targetCues];
    if (nativeCues.length > 0) this.nativeCues = [...nativeCues];
    if (targetCues.length === 0 && nativeCues.length === 0) {
      this.targetCues = [];
      this.nativeCues = [];
    }
    this.bilingual = this.targetCues.length > 0 || this.nativeCues.length > 0;
    this.lastTargetIndex = -1;
    this.lastNativeIndex = -1;
    this.emitCuesUpdated();
  }

  clearCues(): void {
    this.targetCues = [];
    this.nativeCues = [];
    this.bilingual = false;
    this.lastTargetIndex = -1;
    this.lastNativeIndex = -1;
    this.emitCuesUpdated();
  }

  getTargetCues(): readonly SrtCue[] {
    return this.targetCues;
  }

  getNativeCues(): readonly SrtCue[] {
    return this.nativeCues;
  }

  getCurrentTargetText(): string {
    return this.lastTargetIndex >= 0 ? this.targetCues[this.lastTargetIndex]?.text ?? '' : '';
  }

  getCurrentNativeText(): string {
    return this.lastNativeIndex >= 0 ? this.nativeCues[this.lastNativeIndex]?.text ?? '' : '';
  }

  hasSubtitles(): boolean {
    return this.targetCues.length > 0 || this.nativeCues.length > 0;
  }

  getActiveIndices(): { target: number; native: number } {
    return { target: this.lastTargetIndex, native: this.lastNativeIndex };
  }

  getCuesUpdatedDetail(): CuesUpdatedDetail {
    return {
      targetCues: this.targetCues,
      nativeCues: this.nativeCues,
      targetActiveIndex: this.lastTargetIndex,
      nativeActiveIndex: this.lastNativeIndex,
    };
  }

  private emitCuesUpdated(): void {
    const detail = this.getCuesUpdatedDetail();
    this.callbacks.onCuesUpdated?.(detail);
    dispatchCuesUpdated(document, detail);
  }

  getCurrentCuesForRepeat(): { cues: readonly SrtCue[]; index: number } {
    const currentMs = this.video.currentTime * 1000;
    const offsetMs = this.getOffsetMs();
    return findActiveCueIndex(this.targetCues, this.nativeCues, currentMs, offsetMs);
  }

  repeatOnce(): void {
    const currentMs = this.video.currentTime * 1000;
    const offsetMs = this.getOffsetMs();
    const { cues, index } = findActiveCueIndex(this.targetCues, this.nativeCues, currentMs, offsetMs);
    if (index >= 0 && cues[index]) {
      seekVideo(this.video, (cues[index].start - offsetMs) / 1000);
      return;
    }
    const effectiveMs = currentMs + offsetMs;
    let prevIndex = -1;
    for (let i = cues.length - 1; i >= 0; i--) {
      if (cues[i].end <= effectiveMs) { prevIndex = i; break; }
    }
    if (prevIndex >= 0 && cues[prevIndex]) {
      seekVideo(this.video, (cues[prevIndex].start - offsetMs) / 1000);
    }
  }

  handleNoSubRepeatClick(): SubtitleCueEngineRepeatState {
    const currentTime = this.video.currentTime;
    if (this.loopState === 'idle') {
      this.loopStart = currentTime;
      this.loopEnd = currentTime;
      this.loopState = 'a';
      return { icon: 'repeatA', label: 'Repeat A', active: true };
    }
    if (this.loopState === 'a') {
      this.loopEnd = Math.max(this.loopStart + 0.1, currentTime);
      this.loopState = 'looping';
      return { icon: 'repeatCancel', label: 'Repeat cancel', active: true };
    }
    this.loopState = 'idle';
    this.loopEnd = this.loopStart;
    return { icon: 'repeat', label: 'Repeat current sentence', active: false };
  }

  getLoopState(): 'idle' | 'a' | 'looping' {
    return this.loopState;
  }

  cancelLoop(): void {
    this.loopState = 'idle';
    this.loopStart = 0;
    this.loopEnd = 0;
  }

  handlePlayPause(): boolean {
    if (this.video.paused) {
      void this.video.play();
      this.callbacks.onPlayPause?.(true);
      return true;
    }
    this.video.pause();
    this.callbacks.onPlayPause?.(false);
    return false;
  }

  handlePrev(): void {
    prevSentence(this.video, this.targetCues, this.nativeCues, this.getOffsetMs());
  }

  handleNext(): void {
    nextSentence(this.video, this.targetCues, this.nativeCues, this.getOffsetMs());
  }

  handleRewind(): void {
    seekBy(this.video, -5);
  }

  handleForward(): void {
    seekBy(this.video, 10);
  }

  setGenerateNativeEnabled(enabled: boolean): void {
    this.generateNativeEnabled = enabled;
    this.callbacks.onGenerateNativeEnabled?.(enabled);
  }

  isGenerateNativeEnabled(): boolean {
    return this.generateNativeEnabled;
  }

  // === Tokenize-on-media state (rendering is caller's responsibility) ===

  enableTokenize(options: SubtitleCueEngineTokenizeOptions): void {
    this.tokenizeEnabled = true;
    this.tokenizeOptions = options;
  }

  disableTokenize(): void {
    this.tokenizeEnabled = false;
    this.tokenizeOptions = null;
  }

  isTokenizeEnabled(): boolean {
    return this.tokenizeEnabled;
  }

  getTokenizeOptions(): SubtitleCueEngineTokenizeOptions | null {
    return this.tokenizeOptions;
  }

  // === Popup dictionary state (rendering is caller's responsibility) ===

  enableDictionaryPopup(options: SubtitleCueEngineDictionaryOptions): void {
    this.dpEnabled = true;
    this.dpOptions = options;
  }

  disableDictionaryPopup(): void {
    this.dpEnabled = false;
  }

  setDictionaryPopupTriggerMode(mode: TriggerMode): void {
    if (this.dpOptions) {
      this.dpOptions = { ...this.dpOptions, triggerMode: mode };
    }
  }

  isDictionaryPopupEnabled(): boolean {
    return this.dpEnabled;
  }

  getDictionaryOptions(): SubtitleCueEngineDictionaryOptions | null {
    return this.dpOptions;
  }
}
