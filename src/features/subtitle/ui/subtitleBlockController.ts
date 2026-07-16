import { findCurrentLine } from '../logic/subtitleSync';
import type { SrtCue, NavClusterSettings, SubtitleBlockSettings } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import {
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_NAV_CLUSTER_SETTINGS,
} from '@/shared/config/config';
import { buildTextShadow, hexToRgba, sanitizeFontFamily } from './subtitleUI';
import { NAV_CLUSTER_ICONS, type NavClusterIconName } from './navClusterIcons';
import { prevSentence, nextSentence, seekBy, findActiveCueIndex } from './navClusterActions';
import { seekVideo, isNetflixPage } from './netflixPlayback';
import { createSubtitleBlockDOM, type SubtitleBlockDOM } from './subtitleBlockDom';
import { SUBTITLE_BLOCK_CSS } from './subtitleBlockCss';
import { wireBlockDrag } from './subtitleBlockDrag';
import { createBlockScaleObserver, computeScaleSnapshot } from './subtitleBlockScale';
import { syncElementTheme } from '@/shared/lib/themeTokens';
import { mountToWatchVideo } from './netflixPlayback';
import { wrapTokenSpans, detectLangCode, SubtitleTriggerController } from '@/features/dictionaryPopup/trigger/subtitleTriggerController';
import type { LookupRequest } from '@/features/dictionaryPopup/types';

export interface SubtitleBlockControllerUpdate {
  readonly blockSettings?: Partial<SubtitleBlockSettings>;
  readonly targetStyle?: OverlayStyleConfig;
  readonly nativeStyle?: OverlayStyleConfig;
  readonly clusterSettings?: Partial<NavClusterSettings>;
}

/** Card Creator action triggered by the quick-update / edit buttons or q/e keys. */
export type CardCreatorAction = 'quick-update' | 'edit-card';

/** Generate native subtitle action triggered by the generate-native button or shortcut. */
export type GenerateNativeAction = 'generate-native';

const BLOCK_STYLE_ID = 'subtitle-block-css';
const PERSIST_DEBOUNCE_MS = 300;

export class SubtitleBlockController {
  private dom: SubtitleBlockDOM | null = null;
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
  private readonly onPersist: (settings: Partial<SubtitleBlockSettings>) => void;
  private resizeObserver: ResizeObserver | null = null;
  private dragCleanup: (() => void) | null = null;
  private onFullscreenChange: (() => void) | null = null;
  private themeSyncCleanup: (() => void) | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private loopState: 'idle' | 'a' | 'looping' = 'idle';
  private loopStart = 0;
  private loopEnd = 0;
  private readonly onCardCreatorAction: (action: CardCreatorAction) => void;
  private readonly onGenerateNative: () => void;
  /** Popup dictionary state (spec §4.6 — P1.1 wire). */
  private dpEnabled = false;
  private dpTriggerController: SubtitleTriggerController | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly container: HTMLElement,
    blockSettings: SubtitleBlockSettings = DEFAULT_SUBTITLE_BLOCK_SETTINGS,
    targetStyle: OverlayStyleConfig = DEFAULT_OVERLAY_STYLE_TARGET,
    nativeStyle: OverlayStyleConfig = DEFAULT_OVERLAY_STYLE_NATIVE,
    clusterSettings: NavClusterSettings = DEFAULT_NAV_CLUSTER_SETTINGS,
    offsetProvider?: () => number,
    onPersist: (settings: Partial<SubtitleBlockSettings>) => void = () => undefined,
    onCardCreatorAction: (action: CardCreatorAction) => void = () => undefined,
    onGenerateNative: () => void = () => undefined,
  ) {
    this.blockSettings = this.clampBlockSettings(blockSettings);
    this.targetStyle = targetStyle;
    this.nativeStyle = nativeStyle;
    this.clusterSettings = clusterSettings;
    this.getOffsetMs = offsetProvider ?? (() => 0);
    this.onPersist = onPersist;
    this.onCardCreatorAction = onCardCreatorAction;
    this.onGenerateNative = onGenerateNative;
    this.init();
  }

  private init(): void {
    if (this.dom) return;
    this.injectCSS();
    const dom = createSubtitleBlockDOM();
    this.dom = dom;
    this.container.appendChild(dom.block);
    this.themeSyncCleanup = syncElementTheme(dom.block, this.container);
    // ADR-031: Netflix z-index fix — move block to .watch-video so it sits
    // above Netflix's active/inactive wrappers. syncElementTheme already set
    // data-theme on the block, so CSS vars resolve after re-parenting.
    mountToWatchVideo(dom.block, this.container);
    this.applyBlockPosition();
    this.applyLineStyles();
    this.applyClusterLayout();
    this.applyScale();
    this.wireDrag();
    this.wireClusterButtons();
    this.wireFullscreen();
    this.wireTimeUpdate();
    this.startResizeObserver();
  }

  private injectCSS(): void {
    if (document.getElementById(BLOCK_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = BLOCK_STYLE_ID;
    style.textContent = SUBTITLE_BLOCK_CSS;
    (document.head ?? document.documentElement).appendChild(style);
  }

  private clampBlockSettings(settings: SubtitleBlockSettings): SubtitleBlockSettings {
    return {
      yOffsetPercent: Math.min(Math.max(settings.yOffsetPercent, 0), 95),
      globalScale: Math.min(Math.max(settings.globalScale, 0.5), 2),
      bgOpacity: Math.min(Math.max(settings.bgOpacity, 0), 1),
    };
  }

  private applyBlockPosition(): void {
    if (!this.dom) return;
    this.blockSettings = this.clampBlockSettings(this.blockSettings);
    this.dom.block.style.setProperty('--sb-top', `${this.blockSettings.yOffsetPercent}%`);
    this.dom.block.style.setProperty('--sb-bg-opacity', String(this.blockSettings.bgOpacity));
  }

  private applyLineStyles(): void {
    if (!this.dom) return;
    const target = this.dom.targetLine.style;
    target.color = this.targetStyle.textColor;
    target.backgroundColor = hexToRgba(this.targetStyle.backgroundColor, this.targetStyle.backgroundOpacity);
    target.textShadow = buildTextShadow(this.targetStyle.textShadow);
    target.fontFamily = sanitizeFontFamily(this.targetStyle.fontFamily);
    target.textAlign = this.targetStyle.horizontalAlign;
    target.opacity = String(this.targetStyle.textOpacity);

    const native = this.dom.nativeLine.style;
    native.color = this.nativeStyle.textColor;
    native.backgroundColor = hexToRgba(this.nativeStyle.backgroundColor, this.nativeStyle.backgroundOpacity);
    native.textShadow = buildTextShadow(this.nativeStyle.textShadow);
    native.fontFamily = sanitizeFontFamily(this.nativeStyle.fontFamily);
    native.textAlign = this.nativeStyle.horizontalAlign;
    native.opacity = String(this.nativeStyle.textOpacity);
  }

  private applyClusterLayout(): void {
    if (!this.dom) return;
    const hasSub = this.hasSubtitles();
    const enabled = this.clusterSettings.enabled;
    this.dom.block.classList.toggle('cluster-off', !enabled);
    if (!enabled) {
      this.dom.clusterColumnA.style.display = 'none';
      this.dom.clusterColumnB.style.display = 'none';
      this.dom.noSubColumn.style.display = 'none';
      // ADR-026: Card Creator buttons ARE part of the cluster — hide them
      // when the cluster is off (same as nav buttons).
      this.dom.rightColumn.style.display = 'none';
      this.loopState = 'idle';
      return;
    }
    // Cluster on → show Card Creator buttons (they follow cluster settings).
    this.dom.rightColumn.style.display = 'flex';
    if (hasSub) {
      this.dom.clusterColumnA.style.display = 'flex';
      this.dom.clusterColumnB.style.display = 'flex';
      this.dom.noSubColumn.style.display = 'none';
      this.dom.clusterColumnA.append(this.dom.prevBtn, this.dom.repeatBtn, this.dom.nextBtn);
      this.dom.clusterColumnB.append(this.dom.rewindBtn, this.dom.forwardBtn);
      this.setRepeatIcon('repeat', 'Repeat current sentence');
      this.loopState = 'idle';
    } else {
      this.dom.clusterColumnA.style.display = 'none';
      this.dom.clusterColumnB.style.display = 'none';
      this.dom.noSubColumn.style.display = 'flex';
      this.dom.noSubColumn.append(this.dom.rewindBtn, this.dom.repeatBtn, this.dom.forwardBtn);
      this.setRepeatIcon('repeatA', 'Repeat A');
      this.loopState = 'idle';
    }
  }

  private applyScale(): void {
    if (!this.dom) return;
    const containerRect = this.container.getBoundingClientRect();
    const rect =
      containerRect.width > 0 && containerRect.height > 0
        ? containerRect
        : this.video.getBoundingClientRect();
    const snap = computeScaleSnapshot(
      rect.width,
      rect.height,
      this.targetStyle,
      this.nativeStyle,
      this.clusterSettings.buttonSize,
      this.blockSettings.globalScale,
    );
    const enabled = this.clusterSettings.enabled;
    const clusterWidth = enabled ? snap.clusterWidth : 0;
    this.dom.block.style.setProperty('--sb-target-font', `${snap.targetFontSize}px`);
    this.dom.block.style.setProperty('--sb-native-font', `${snap.nativeFontSize}px`);
    this.dom.block.style.setProperty('--sb-btn-size', `${snap.buttonSize}px`);
    this.dom.block.style.setProperty('--sb-text-opacity', String(this.clusterSettings.textOpacity));
    this.dom.block.style.setProperty('--sb-bg-opacity', String(this.clusterSettings.bgOpacity));
    this.dom.block.style.setProperty('--sb-cluster-width', `${clusterWidth}px`);
    // Propagate button size + opacity to sibling overlay buttons (toggle,
    // manager, import) so they resize + fade with the cluster setting.
    // On non-Netflix they're under container; on Netflix they're under .watch-video.
    this.container.style.setProperty('--sb-btn-size', `${snap.buttonSize}px`);
    this.container.style.setProperty('--sb-text-opacity', String(this.clusterSettings.textOpacity));
    this.container.style.setProperty('--sb-bg-opacity', String(this.clusterSettings.bgOpacity));
    const watchVideo = document.querySelector('.watch-video');
    if (watchVideo instanceof HTMLElement) {
      watchVideo.style.setProperty('--sb-btn-size', `${snap.buttonSize}px`);
      watchVideo.style.setProperty('--sb-text-opacity', String(this.clusterSettings.textOpacity));
      watchVideo.style.setProperty('--sb-bg-opacity', String(this.clusterSettings.bgOpacity));
    }
  }

  private render(): void {
    if (!this.dom) return;
    const targetText = this.lastTargetIndex >= 0 ? this.targetCues[this.lastTargetIndex]?.text ?? '' : '';
    const nativeText = this.lastNativeIndex >= 0 ? this.nativeCues[this.lastNativeIndex]?.text ?? '' : '';
    console.debug('[SB] render', { targetVisible: this.targetStyle.visible, nativeVisible: this.nativeStyle.visible, targetText: targetText.slice(0, 60), nativeText: nativeText.slice(0, 60), lastTargetIndex: this.lastTargetIndex, lastNativeIndex: this.lastNativeIndex });
    this.dom.targetLine.textContent = this.targetStyle.visible ? targetText : '';
    this.dom.targetLine.style.display = this.targetStyle.visible && targetText ? 'block' : 'none';
    this.dom.nativeLine.textContent = this.nativeStyle.visible ? nativeText : '';
    this.dom.nativeLine.style.display = this.nativeStyle.visible && nativeText ? 'block' : 'none';

    // Popup dictionary: wrap target line tokens + attach trigger (spec §4.6).
    if (this.dpEnabled && this.targetStyle.visible && targetText) {
      this.wrapTargetLineTokens(targetText);
    }
  }

  /** Wrap target line text into per-token spans + attach trigger controller. */
  private wrapTargetLineTokens(text: string): void {
    if (!this.dom) return;
    // targetLine is a div, but wrapTokenSpans expects a span with textContent.
    // Create a temporary span, wrap it, then move children back.
    const langCode = detectLangCode(text);
    const tempSpan = document.createElement('span');
    tempSpan.textContent = text;
    const tokenSpans = wrapTokenSpans(tempSpan, text, langCode);
    // Replace targetLine content with wrapped tokens.
    this.dom.targetLine.textContent = '';
    while (tempSpan.firstChild) {
      this.dom.targetLine.appendChild(tempSpan.firstChild);
    }
    // Attach trigger controller if available.
    if (this.dpTriggerController) {
      this.dpTriggerController.detach();
      if (tokenSpans.length > 0) {
        this.dpTriggerController.attach(tokenSpans, text, langCode);
      }
    }
  }

  private onTimeUpdate = (): void => {
    if (this.loopState === 'looping' && this.video.currentTime >= this.loopEnd) {
      // ADR-030: route through seekVideo to avoid Netflix M7375.
      seekVideo(this.video, this.loopStart);
    }
    if (!this.dom) return;
    if (this.targetCues.length === 0 && this.nativeCues.length === 0) return;

    const currentTimeMs = this.video.currentTime * 1000;
    const offsetMs = this.getOffsetMs();

    if (this.bilingual) {
      const targetIndex = findCurrentLine(this.targetCues, currentTimeMs, offsetMs);
      const nativeIndex = findCurrentLine(this.nativeCues, currentTimeMs, offsetMs);
      if (targetIndex === this.lastTargetIndex && nativeIndex === this.lastNativeIndex) return;
      this.lastTargetIndex = targetIndex;
      this.lastNativeIndex = nativeIndex;
      this.render();
      return;
    }

    if (this.targetCues.length === 0) return;
    const targetIndex = findCurrentLine(this.targetCues, currentTimeMs, offsetMs);
    if (targetIndex === this.lastTargetIndex) return;
    this.lastTargetIndex = targetIndex;
    this.lastNativeIndex = -1;
    this.render();
  };

  private wireDrag(): void {
    if (!this.dom) return;
    this.dragCleanup = wireBlockDrag(this.dom.block, this.container, {
      getYOffset: () => this.blockSettings.yOffsetPercent,
      setYOffset: (value) => this.setYOffset(value),
      onEnd: (value) => {
        this.setYOffset(value);
        this.persist({ yOffsetPercent: value });
      },
    });
  }

  private setYOffset(value: number): void {
    this.blockSettings = { ...this.blockSettings, yOffsetPercent: Math.min(Math.max(value, 0), 95) };
    if (this.dom) {
      this.dom.block.style.setProperty('--sb-top', `${this.blockSettings.yOffsetPercent}%`);
    }
  }

  private persist(partial: Partial<SubtitleBlockSettings>): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.onPersist(partial);
    }, PERSIST_DEBOUNCE_MS);
  }

  private wireClusterButtons(): void {
    if (!this.dom) return;
    this.dom.prevBtn.addEventListener('click', () => prevSentence(this.video, this.targetCues, this.nativeCues, this.getOffsetMs()));
    this.dom.nextBtn.addEventListener('click', () => nextSentence(this.video, this.targetCues, this.nativeCues, this.getOffsetMs()));
    this.dom.rewindBtn.addEventListener('click', () => seekBy(this.video, -5));
    this.dom.forwardBtn.addEventListener('click', () => seekBy(this.video, 10));
    this.dom.repeatBtn.addEventListener('click', () => this.handleRepeatClick());
    // ADR-026: Card Creator entry buttons.
    this.dom.quickUpdateBtn.addEventListener('click', () => this.onCardCreatorAction('quick-update'));
    this.dom.editCardBtn.addEventListener('click', () => this.onCardCreatorAction('edit-card'));
    // Generate native subtitle action.
    this.dom.generateNativeBtn.addEventListener('click', () => this.onGenerateNative());
  }

  private handleRepeatClick(): void {
    if (this.hasSubtitles()) {
      this.repeatOnce();
      return;
    }
    this.handleNoSubRepeatClick();
  }

  private repeatOnce(): void {
    const currentMs = this.video.currentTime * 1000;
    const offsetMs = this.getOffsetMs();
    const { cues, index } = findActiveCueIndex(this.targetCues, this.nativeCues, currentMs, offsetMs);
    if (index >= 0 && cues[index]) {
      // ADR-030: route through seekVideo to avoid Netflix M7375.
      seekVideo(this.video, (cues[index].start - offsetMs) / 1000);
      return;
    }
    // In gap (index === -1): seek to the PREVIOUS cue (end <= effectiveMs,
    // nearest), not the nearest cue overall. Otherwise repeat == next when
    // the next cue's start is closer to currentMs than the previous cue's end.
    const effectiveMs = currentMs + offsetMs;
    let prevIndex = -1;
    for (let i = cues.length - 1; i >= 0; i--) {
      if (cues[i].end <= effectiveMs) { prevIndex = i; break; }
    }
    if (prevIndex >= 0 && cues[prevIndex]) {
      seekVideo(this.video, (cues[prevIndex].start - offsetMs) / 1000);
    }
  }

  private handleNoSubRepeatClick(): void {
    if (!this.dom) return;
    const currentTime = this.video.currentTime;
    if (this.loopState === 'idle') {
      this.loopStart = currentTime;
      this.loopEnd = currentTime;
      this.loopState = 'a';
      this.setRepeatIcon('repeatB', 'Repeat B');
      return;
    }
    if (this.loopState === 'a') {
      this.loopEnd = Math.max(this.loopStart + 0.1, currentTime);
      this.loopState = 'looping';
      this.setRepeatIcon('repeatCancel', 'Repeat cancel');
      return;
    }
    this.loopState = 'idle';
    this.loopEnd = this.loopStart;
    this.setRepeatIcon('repeatA', 'Repeat A');
  }

  private setRepeatIcon(icon: NavClusterIconName, label?: string): void {
    if (!this.dom) return;
    const html = NAV_CLUSTER_ICONS[icon];
    if (html) this.dom.repeatBtn.innerHTML = html;
    if (label) this.dom.repeatBtn.setAttribute('aria-label', label);
  }

  private wireFullscreen(): void {
    this.onFullscreenChange = () => {
      if (!this.dom) return;
      const fsElement = document.fullscreenElement as HTMLElement | null;
      // ADR-031: Netflix — block already mounted to .watch-video by
      // mountToWatchVideo. Do NOT re-parent into fsElement (which may be
      // <video> on Netflix — a replaced element that does not render DOM
      // children, making the block invisible). .watch-video is the common
      // parent of Netflix's active/inactive wrappers and works in both
      // non-fullscreen and fullscreen (Netflix uses DIV.watch-video for
      // its own fullscreen, not <video>).
      if (isNetflixPage()) {
        this.applyScale();
        return;
      }
      const targetParent = fsElement ?? this.container;
      if (this.dom.block.parentElement !== targetParent) {
        targetParent.appendChild(this.dom.block);
      }
      this.applyScale();
    };
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
  }

  private wireTimeUpdate(): void {
    this.video.addEventListener('timeupdate', this.onTimeUpdate);
  }

  private startResizeObserver(): void {
    this.resizeObserver = createBlockScaleObserver(this.container, () => {
      this.applyScale();
    });
  }

  private hasSubtitles(): boolean {
    return this.targetCues.length > 0 || this.nativeCues.length > 0;
  }

  setOffsetProvider(provider: () => number): void {
    this.getOffsetMs = provider;
  }

  updateSettings(update: SubtitleBlockControllerUpdate): void {
    const needsScale = !!(update.blockSettings || update.targetStyle || update.nativeStyle || update.clusterSettings);
    if (update.blockSettings) {
      this.blockSettings = this.clampBlockSettings({ ...this.blockSettings, ...update.blockSettings });
    }
    if (update.targetStyle) this.targetStyle = update.targetStyle;
    if (update.nativeStyle) this.nativeStyle = update.nativeStyle;
    if (update.clusterSettings) this.clusterSettings = { ...this.clusterSettings, ...update.clusterSettings };

    if (update.blockSettings) this.applyBlockPosition();
    if (update.clusterSettings) this.applyClusterLayout();
    if (update.targetStyle || update.nativeStyle) {
      this.applyLineStyles();
      this.render();
    }
    if (needsScale) this.applyScale();
  }

  loadCues(cues: SrtCue[]): void {
    this.targetCues = cues;
    this.nativeCues = [];
    this.bilingual = false;
    this.lastTargetIndex = -1;
    this.lastNativeIndex = -1;
    this.applyClusterLayout();
    this.onTimeUpdate();
    this.render();
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
    this.applyClusterLayout();
    this.onTimeUpdate();
  }

  /** ADR-026: Get current target cues (for Card Creator context). */
  getTargetCues(): readonly SrtCue[] {
    return this.targetCues;
  }

  /** ADR-026: Get current native cues (for Card Creator context). */
  getNativeCues(): readonly SrtCue[] {
    return this.nativeCues;
  }

  /** Enable/disable the generate-native button. */
  setGenerateNativeEnabled(enabled: boolean): void {
    if (!this.dom) return;
    this.dom.generateNativeBtn.disabled = !enabled;
    this.dom.generateNativeBtn.setAttribute('aria-disabled', String(!enabled));
  }

  clearCues(): void {
    this.targetCues = [];
    this.nativeCues = [];
    this.bilingual = false;
    this.lastTargetIndex = -1;
    this.lastNativeIndex = -1;
    this.applyClusterLayout();
    this.render();
  }

  destroy(): void {
    this.video.removeEventListener('timeupdate', this.onTimeUpdate);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.dragCleanup?.();
    this.dragCleanup = null;
    if (this.onFullscreenChange) {
      document.removeEventListener('fullscreenchange', this.onFullscreenChange);
      this.onFullscreenChange = null;
    }
    if (this.themeSyncCleanup) {
      this.themeSyncCleanup();
      this.themeSyncCleanup = null;
    }
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.dom) {
      this.dom.block.remove();
      this.dom = null;
    }
    // Cleanup popup dictionary trigger.
    if (this.dpTriggerController) {
      this.dpTriggerController.detach();
      this.dpTriggerController = null;
    }
  }

  // === Popup Dictionary integration (spec §4.6) ===

  /** Enable popup dictionary on this subtitle block. */
  enableDictionaryPopup(
    triggerMode: 'click' | 'hover' | 'hover-ctrl' | 'hover-shift' | 'hover-alt',
    onLookup: (request: LookupRequest, requestId: string) => void,
    onCancel: (requestId: string) => void,
  ): void {
    this.dpEnabled = true;
    if (!this.dpTriggerController) {
      this.dpTriggerController = new SubtitleTriggerController({
        triggerMode,
        onLookup,
        onCancel,
      });
    }
    // Re-render to wrap tokens on current cue.
    this.render();
  }

  /** Disable popup dictionary. */
  disableDictionaryPopup(): void {
    this.dpEnabled = false;
    if (this.dpTriggerController) {
      this.dpTriggerController.detach();
    }
    // Re-render to restore plain text.
    this.render();
  }

  /** Update trigger mode (re-attaches listeners). */
  setDictionaryPopupTriggerMode(mode: 'click' | 'hover' | 'hover-ctrl' | 'hover-shift' | 'hover-alt'): void {
    if (this.dpTriggerController) {
      this.dpTriggerController.setTriggerMode(mode);
    }
  }

  /** Check if popup dictionary is enabled. */
  isDictionaryPopupEnabled(): boolean {
    return this.dpEnabled;
  }
}
