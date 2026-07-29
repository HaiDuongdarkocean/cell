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
import { dispatchCuesUpdated } from '@/features/subtitle/events';
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
import type { LookupRequest, TriggerMode } from '@/features/dictionaryPopup/types';
import {
  createSubtitleTokenizeController,
  type SubtitleTokenizeController,
  type SubtitleTokenizeControllerOptions,
} from '@/features/tokenize/controller/subtitleTokenizeController';

export interface SubtitleBlockControllerUpdate {
  readonly blockSettings?: Partial<SubtitleBlockSettings>;
  readonly targetStyle?: OverlayStyleConfig;
  readonly nativeStyle?: OverlayStyleConfig;
  readonly clusterSettings?: Partial<NavClusterSettings>;
}

/** Card Creator action triggered by the quick-update / edit buttons or q/e keys. */
export type CardCreatorAction = 'quick-update' | 'edit-card' | 'update-current';

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
  private onVideoPlay: (() => void) | null = null;
  private onVideoPause: (() => void) | null = null;
  private onScroll: (() => void) | null = null;
  private positionRaf = 0;
  private themeSyncCleanup: (() => void) | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private loopState: 'idle' | 'a' | 'looping' = 'idle';
  private loopStart = 0;
  private loopEnd = 0;
  private readonly onCardCreatorAction: (action: CardCreatorAction) => void;
  private readonly onUpdateCurrentCard: () => void;
  private readonly onGenerateNative: () => void;
  /** More popover open state + cleanup for outside-click/Esc listeners. */
  private morePopoverOpen = false;
  private morePopoverCleanup: (() => void) | null = null;
  /** Popup dictionary state (spec §4.6 — P1.1 wire). */
  private dpEnabled = false;
  private dpTriggerController: SubtitleTriggerController | null = null;
  /** Tokenize-on-media controller for active cue (T14). */
  private tokenizeController: SubtitleTokenizeController | null = null;

  private emitCuesUpdated(): void {
    dispatchCuesUpdated(document, {
      targetCues: this.targetCues,
      nativeCues: this.nativeCues,
      targetActiveIndex: this.lastTargetIndex,
      nativeActiveIndex: this.lastNativeIndex,
    });
  }

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
    onUpdateCurrentCard: () => void = () => undefined,
    onGenerateNative: () => void = () => undefined,
  ) {
    this.blockSettings = this.clampBlockSettings(blockSettings);
    this.targetStyle = targetStyle;
    this.nativeStyle = nativeStyle;
    this.clusterSettings = clusterSettings;
    this.getOffsetMs = offsetProvider ?? (() => 0);
    this.onPersist = onPersist;
    this.onCardCreatorAction = onCardCreatorAction;
    this.onUpdateCurrentCard = onUpdateCurrentCard;
    this.onGenerateNative = onGenerateNative;
    this.init();
  }

  private init(): void {
    if (this.dom) return;
    this.injectCSS();
    const dom = createSubtitleBlockDOM();
    this.dom = dom;
    // Mount on document.body with position:fixed so the block escapes the
    // video container's stacking context and is never covered by site overlays.
    // Exception: Netflix needs .watch-video parenting (ADR-031), and fullscreen
    // needs the block inside the fullscreen element.
    document.body.appendChild(dom.block);
    this.themeSyncCleanup = syncElementTheme(dom.block, this.container);
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
    this.wirePositionSync();
    this.syncPosition();
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
    this.syncPosition();
  }

  /** Sync the block's fixed position from the video container's rect.
   *  In fullscreen mode, the block is position:absolute inside the fullscreen
   *  element, so no sync is needed. */
  private syncPosition(): void {
    if (!this.dom) return;
    const fs = document.fullscreenElement;
    if (fs && fs.contains(this.dom.block)) {
      // Fullscreen: position:absolute relative to fullscreen element.
      this.dom.block.style.position = 'absolute';
      this.dom.block.style.left = '0';
      this.dom.block.style.top = `${this.blockSettings.yOffsetPercent}%`;
      this.dom.block.style.width = '100%';
      return;
    }
    // Non-fullscreen: position:fixed relative to viewport, synced from container.
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.dom.block.style.position = 'fixed';
    this.dom.block.style.left = `${rect.left}px`;
    this.dom.block.style.top = `${rect.top + rect.height * (this.blockSettings.yOffsetPercent / 100)}px`;
    this.dom.block.style.width = `${rect.width}px`;
  }

  /** rAF-throttled scroll/resize listener for position sync. */
  private wirePositionSync(): void {
    this.onScroll = (): void => {
      if (this.positionRaf) return;
      this.positionRaf = requestAnimationFrame(() => {
        this.positionRaf = 0;
        this.syncPosition();
      });
    };
    window.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });
  }

  private applyLineStyles(): void {
    if (!this.dom) return;
    const target = this.dom.targetLine.style;
    target.color = this.targetStyle.textColor;
    target.backgroundColor = hexToRgba(this.targetStyle.backgroundColor, this.targetStyle.backgroundOpacity);
    target.textShadow = buildTextShadow(this.targetStyle.textShadow);
    target.fontFamily = sanitizeFontFamily(this.targetStyle.fontFamily);
    target.fontWeight = String(this.targetStyle.fontWeight ?? 600);
    target.textAlign = this.targetStyle.horizontalAlign;
    target.opacity = String(this.targetStyle.textOpacity);

    const native = this.dom.nativeLine.style;
    native.color = this.nativeStyle.textColor;
    native.backgroundColor = hexToRgba(this.nativeStyle.backgroundColor, this.nativeStyle.backgroundOpacity);
    native.textShadow = buildTextShadow(this.nativeStyle.textShadow);
    native.fontFamily = sanitizeFontFamily(this.nativeStyle.fontFamily);
    native.fontWeight = String(this.nativeStyle.fontWeight ?? 600);
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
      this.dom.clusterColumnB.append(this.dom.rewindBtn, this.dom.playPauseBtn, this.dom.forwardBtn);
      this.setRepeatIcon('repeat', 'Repeat current sentence');
      this.loopState = 'idle';
    } else {
      // No subtitles: hide column A (prev/repeat/next need subtitle cues),
      // but keep column B (rewind/play-pause/forward) visible so the user
      // can still control video playback without subtitle navigation.
      this.dom.clusterColumnA.style.display = 'none';
      this.dom.clusterColumnB.style.display = 'flex';
      this.dom.noSubColumn.style.display = 'none';
      this.dom.clusterColumnB.append(this.dom.rewindBtn, this.dom.playPauseBtn, this.dom.forwardBtn);
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
    this.dom.targetLine.textContent = this.targetStyle.visible ? targetText : '';
    this.dom.targetLine.style.display = this.targetStyle.visible && targetText ? 'block' : 'none';
    this.dom.nativeLine.textContent = this.nativeStyle.visible ? nativeText : '';
    this.dom.nativeLine.style.display = this.nativeStyle.visible && nativeText ? 'block' : 'none';

    // Tokenize on media: wrap active cue with status/frequency + click handlers (T14).
    if (this.tokenizeController) {
      this.tokenizeController.render(this.lastTargetIndex, this.lastNativeIndex);
      return;
    }

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
      this.emitCuesUpdated();
      return;
    }

    if (this.targetCues.length === 0) return;
    const targetIndex = findCurrentLine(this.targetCues, currentTimeMs, offsetMs);
    if (targetIndex === this.lastTargetIndex) return;
    this.lastTargetIndex = targetIndex;
    this.lastNativeIndex = -1;
    this.render();
    this.emitCuesUpdated();
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
    this.dom.playPauseBtn.addEventListener('click', () => this.handlePlayPause());
    this.syncPlayPauseIcon();
    // Sync icon when video play/pause state changes externally (e.g. user
    // clicks the native video controls).
    this.onVideoPlay = () => this.syncPlayPauseIcon();
    this.onVideoPause = () => this.syncPlayPauseIcon();
    this.video.addEventListener('play', this.onVideoPlay);
    this.video.addEventListener('pause', this.onVideoPause);
    this.dom.repeatBtn.addEventListener('click', () => this.handleRepeatClick());
    // ADR-026: Card Creator entry buttons.
    this.dom.quickUpdateBtn.addEventListener('click', () => this.onCardCreatorAction('quick-update'));
    this.dom.editCardBtn.addEventListener('click', () => this.onCardCreatorAction('edit-card'));
    // ADR-027: Update current card (secondary column).
    this.dom.updateCurrentCardBtn.addEventListener('click', () => this.onUpdateCurrentCard());
    // Generate native subtitle action.
    this.dom.generateNativeBtn.addEventListener('click', () => this.onGenerateNative());
    // ADR-027: More button toggles the overflow popover.
    this.dom.moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMorePopover();
    });
  }

  /** ADR-027: Toggle the more-popover open/closed. */
  private toggleMorePopover(): void {
    if (!this.dom) return;
    if (this.morePopoverOpen) this.closeMorePopover();
    else this.openMorePopover();
  }

  private openMorePopover(): void {
    if (!this.dom || this.morePopoverOpen) return;
    this.morePopoverOpen = true;
    this.dom.morePopover.classList.add('more-popover--open');
    this.dom.moreBtn.setAttribute('aria-expanded', 'true');

    // Click-outside + Esc close — bound once, cleaned up on close.
    const onOutside = (e: MouseEvent): void => {
      if (!this.dom) return;
      const t = e.target as Node | null;
      if (t && (this.dom.morePopover.contains(t) || this.dom.moreBtn.contains(t))) return;
      this.closeMorePopover();
    };
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') this.closeMorePopover();
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    this.morePopoverCleanup = (): void => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }

  private closeMorePopover(): void {
    if (!this.dom || !this.morePopoverOpen) return;
    this.morePopoverOpen = false;
    this.dom.morePopover.classList.remove('more-popover--open');
    this.dom.moreBtn.setAttribute('aria-expanded', 'false');
    this.morePopoverCleanup?.();
    this.morePopoverCleanup = null;
  }

  /** ADR-027: Attach overflow buttons (panel-toggle, import-button) and the
   *  subtitle-manager-icon into the right column slots. Called by
   *  contentScriptController after creating those elements externally. */
  attachOverflowButtons(buttons: {
    panelToggle?: HTMLElement;
    importButton?: HTMLElement;
    managerIcon?: HTMLElement;
  }): void {
    if (!this.dom) return;
    if (buttons.panelToggle) this.dom.panelToggleSlot.appendChild(buttons.panelToggle);
    if (buttons.importButton) this.dom.importButtonSlot.appendChild(buttons.importButton);
    if (buttons.managerIcon) this.dom.managerIconSlot.appendChild(buttons.managerIcon);
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

  /** Toggle video play/pause. */
  private handlePlayPause(): void {
    if (this.video.paused) {
      void this.video.play();
    } else {
      this.video.pause();
    }
  }

  /** Sync play/pause button icon + aria-label with video state. */
  private syncPlayPauseIcon(): void {
    if (!this.dom) return;
    const isPaused = this.video.paused;
    this.dom.playPauseBtn.innerHTML = isPaused ? NAV_CLUSTER_ICONS.play : NAV_CLUSTER_ICONS.pause;
    this.dom.playPauseBtn.setAttribute('aria-label', isPaused ? 'Play video' : 'Pause video');
    this.dom.playPauseBtn.setAttribute('aria-pressed', String(!isPaused));
  }

  private wireFullscreen(): void {
    this.onFullscreenChange = () => {
      if (!this.dom) return;
      const fsElement = document.fullscreenElement as HTMLElement | null;
      if (isNetflixPage()) {
        this.applyScale();
        this.syncPosition();
        return;
      }
      // Fullscreen: move block inside fullscreen element so it's visible.
      // Non-fullscreen: move to document.body (position:fixed escapes stacking).
      const targetParent = fsElement ?? document.body;
      if (this.dom.block.parentElement !== targetParent) {
        targetParent.appendChild(this.dom.block);
      }
      this.applyScale();
      this.syncPosition();
    };
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
  }

  private wireTimeUpdate(): void {
    this.video.addEventListener('timeupdate', this.onTimeUpdate);
  }

  private startResizeObserver(): void {
    this.resizeObserver = createBlockScaleObserver(this.container, () => {
      this.applyScale();
      this.syncPosition();
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
    this.tokenizeController?.setCues(this.targetCues, this.nativeCues);
    this.applyClusterLayout();
    this.onTimeUpdate();
    this.render();
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
    this.tokenizeController?.setCues(this.targetCues, this.nativeCues);
    this.applyClusterLayout();
    this.onTimeUpdate();
    this.emitCuesUpdated();
  }

  /** ADR-026: Get current target cues (for Card Creator context). */
  getTargetCues(): readonly SrtCue[] {
    return this.targetCues;
  }

  /** ADR-026: Get current native cues (for Card Creator context). */
  getNativeCues(): readonly SrtCue[] {
    return this.nativeCues;
  }

  /** Get the active target subtitle text (current cue). */
  getCurrentTargetText(): string {
    return this.lastTargetIndex >= 0 ? this.targetCues[this.lastTargetIndex]?.text ?? '' : '';
  }

  /** Get the active native subtitle text (current cue). */
  getCurrentNativeText(): string {
    return this.lastNativeIndex >= 0 ? this.nativeCues[this.lastNativeIndex]?.text ?? '' : '';
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
    this.tokenizeController?.setCues(this.targetCues, this.nativeCues);
    this.applyClusterLayout();
    this.render();
    this.emitCuesUpdated();
  }

  destroy(): void {
    this.video.removeEventListener('timeupdate', this.onTimeUpdate);
    if (this.onVideoPlay) {
      this.video.removeEventListener('play', this.onVideoPlay);
      this.onVideoPlay = null;
    }
    if (this.onVideoPause) {
      this.video.removeEventListener('pause', this.onVideoPause);
      this.onVideoPause = null;
    }
    if (this.onScroll) {
      window.removeEventListener('scroll', this.onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', this.onScroll);
      this.onScroll = null;
    }
    if (this.positionRaf) {
      cancelAnimationFrame(this.positionRaf);
      this.positionRaf = 0;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.dragCleanup?.();
    this.dragCleanup = null;
    this.closeMorePopover();
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
    // Cleanup tokenize controller (T14).
    if (this.tokenizeController) {
      this.tokenizeController.destroy();
      this.tokenizeController = null;
    }
  }

  // === Popup Dictionary integration (spec §4.6) ===

  /** Enable popup dictionary on this subtitle block. */
  enableDictionaryPopup(
    triggerMode: TriggerMode,
    onLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect, highlightTarget: HTMLSpanElement) => void,
    onCancel: (requestId: string) => void,
    onClear?: () => void,
  ): void {
    this.dpEnabled = true;
    if (!this.dpTriggerController) {
      this.dpTriggerController = new SubtitleTriggerController({
        triggerMode,
        onLookup,
        onCancel,
        onClear,
      });
    } else {
      // The controller already exists (e.g. settings changed at runtime).
      // Update its mode instead of leaving the first-selected mode stuck.
      this.dpTriggerController.setTriggerMode(triggerMode);
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
  setDictionaryPopupTriggerMode(mode: TriggerMode): void {
    if (this.dpTriggerController) {
      this.dpTriggerController.setTriggerMode(mode);
    }
  }

  /** Check if popup dictionary is enabled. */
  isDictionaryPopupEnabled(): boolean {
    return this.dpEnabled;
  }

  // === Tokenize on media integration (T14/T15) ===

  /** Enable tokenize on the subtitle block. */
  enableTokenize(
    options: Pick<SubtitleTokenizeControllerOptions, 'onOpenDictionary' | 'langCode' | 'windowSize'>,
  ): void {
    if (this.tokenizeController) {
      this.tokenizeController.destroy();
    }
    this.tokenizeController = createSubtitleTokenizeController({
      ...options,
      getLineElements: () => ({ target: this.dom?.targetLine ?? null, native: this.dom?.nativeLine ?? null }),
    });
    this.tokenizeController.setCues(this.targetCues, this.nativeCues);
    this.tokenizeController.enable();
    this.render();
  }

  /** Disable tokenize and restore plain cue text. */
  disableTokenize(): void {
    if (this.tokenizeController) {
      this.tokenizeController.destroy();
      this.tokenizeController = null;
    }
    this.render();
  }

  /** Toggle tokenize status display. */
  setTokenizeShowStatus(show: boolean): void {
    this.tokenizeController?.setShowStatus(show);
  }

  /** Toggle tokenize frequency display. */
  setTokenizeShowFrequency(show: boolean): void {
    this.tokenizeController?.setShowFrequency(show);
  }

  /** Check if tokenize is enabled. */
  isTokenizeEnabled(): boolean {
    return this.tokenizeController?.getState().enabled ?? false;
  }
}
