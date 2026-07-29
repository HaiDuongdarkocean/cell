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
import { isNetflixPage } from './netflixPlayback';
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
import { SubtitleCueEngine, type SubtitleCueEngineUpdate } from './subtitleCueEngine';
import type { SubtitleCueEngineTokenizeOptions } from './subtitleCueEngine';

export type SubtitleBlockControllerUpdate = SubtitleCueEngineUpdate;

/** Card Creator action triggered by the quick-update / edit buttons or q/e keys. */
export type CardCreatorAction = 'quick-update' | 'edit-card' | 'update-current';

/** Generate native subtitle action triggered by the generate-native button or shortcut. */
export type GenerateNativeAction = 'generate-native';

const BLOCK_STYLE_ID = 'subtitle-block-css';
const PERSIST_DEBOUNCE_MS = 300;

export class SubtitleBlockController {
  private dom: SubtitleBlockDOM | null = null;
  private readonly engine: SubtitleCueEngine;
  private container: HTMLElement;
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
  private morePopoverOpen = false;
  private morePopoverCleanup: (() => void) | null = null;
  private dpTriggerController: import('@/features/dictionaryPopup/trigger/subtitleTriggerController').SubtitleTriggerController | null = null;
  private tokenizeController: SubtitleTokenizeController | null = null;
  private readonly onCardCreatorAction: (action: CardCreatorAction) => void;
  private readonly onUpdateCurrentCard: () => void;
  private readonly onGenerateNative: () => void;

  constructor(
    private readonly video: HTMLVideoElement,
    container: HTMLElement,
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
    this.container = container;
    this.onPersist = onPersist;
    this.onCardCreatorAction = onCardCreatorAction;
    this.onUpdateCurrentCard = onUpdateCurrentCard;
    this.onGenerateNative = onGenerateNative;
    this.engine = new SubtitleCueEngine(
      video,
      blockSettings,
      targetStyle,
      nativeStyle,
      clusterSettings,
      offsetProvider,
      {
        onCuesUpdated: () => this.render(),
        onStyleUpdated: () => this.applyStyleUpdate(),
        onPlayPause: () => this.syncPlayPauseIcon(),
        onGenerateNativeEnabled: (enabled) => this.setGenerateNativeButtonEnabled(enabled),
      },
    );
    this.init();
  }

  private init(): void {
    if (this.dom) return;
    this.injectCSS();
    const dom = createSubtitleBlockDOM();
    this.dom = dom;
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

  private applyStyleUpdate(): void {
    if (!this.dom) return;
    this.applyBlockPosition();
    this.applyLineStyles();
    this.applyClusterLayout();
    this.applyScale();
    this.render();
  }

  private applyBlockPosition(): void {
    if (!this.dom) return;
    const settings = this.engine.getBlockSettings();
    this.dom.block.style.setProperty('--sb-top', `${settings.yOffsetPercent}%`);
    this.dom.block.style.setProperty('--sb-bg-opacity', String(settings.bgOpacity));
    this.syncPosition();
  }

  private syncPosition(): void {
    if (!this.dom) return;
    const fs = document.fullscreenElement;
    const settings = this.engine.getBlockSettings();
    if (fs && fs.contains(this.dom.block)) {
      this.dom.block.style.position = 'absolute';
      this.dom.block.style.left = '0';
      this.dom.block.style.top = `${settings.yOffsetPercent}%`;
      this.dom.block.style.width = '100%';
      return;
    }
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.dom.block.style.position = 'fixed';
    this.dom.block.style.left = `${rect.left}px`;
    this.dom.block.style.top = `${rect.top + rect.height * (settings.yOffsetPercent / 100)}px`;
    this.dom.block.style.width = `${rect.width}px`;
  }

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
    const targetStyle = this.engine.getTargetStyle();
    const nativeStyle = this.engine.getNativeStyle();

    const target = this.dom.targetLine.style;
    target.color = targetStyle.textColor;
    target.backgroundColor = hexToRgba(targetStyle.backgroundColor, targetStyle.backgroundOpacity);
    target.textShadow = buildTextShadow(targetStyle.textShadow);
    target.fontFamily = sanitizeFontFamily(targetStyle.fontFamily);
    target.fontWeight = String(targetStyle.fontWeight ?? 600);
    target.textAlign = targetStyle.horizontalAlign;
    target.opacity = String(targetStyle.textOpacity);

    const native = this.dom.nativeLine.style;
    native.color = nativeStyle.textColor;
    native.backgroundColor = hexToRgba(nativeStyle.backgroundColor, nativeStyle.backgroundOpacity);
    native.textShadow = buildTextShadow(nativeStyle.textShadow);
    native.fontFamily = sanitizeFontFamily(nativeStyle.fontFamily);
    native.fontWeight = String(nativeStyle.fontWeight ?? 600);
    native.textAlign = nativeStyle.horizontalAlign;
    native.opacity = String(nativeStyle.textOpacity);
  }

  private applyClusterLayout(): void {
    if (!this.dom) return;
    const hasSub = this.engine.hasSubtitles();
    const clusterSettings = this.engine.getClusterSettings();
    this.dom.block.classList.toggle('cluster-off', !clusterSettings.enabled);
    if (!clusterSettings.enabled) {
      this.dom.clusterColumnA.style.display = 'none';
      this.dom.clusterColumnB.style.display = 'none';
      this.dom.noSubColumn.style.display = 'none';
      this.dom.rightColumn.style.display = 'none';
      this.engine.cancelLoop();
      return;
    }
    this.dom.rightColumn.style.display = 'flex';
    if (hasSub) {
      this.dom.clusterColumnA.style.display = 'flex';
      this.dom.clusterColumnB.style.display = 'flex';
      this.dom.noSubColumn.style.display = 'none';
      this.dom.clusterColumnA.append(this.dom.prevBtn, this.dom.repeatBtn, this.dom.nextBtn);
      this.dom.clusterColumnB.append(this.dom.rewindBtn, this.dom.playPauseBtn, this.dom.forwardBtn);
      this.setRepeatIcon('repeat', 'Repeat current sentence');
      this.engine.cancelLoop();
    } else {
      this.dom.clusterColumnA.style.display = 'none';
      this.dom.clusterColumnB.style.display = 'flex';
      this.dom.noSubColumn.style.display = 'none';
      this.dom.clusterColumnB.append(this.dom.rewindBtn, this.dom.playPauseBtn, this.dom.forwardBtn);
      this.setRepeatIcon('repeatA', 'Repeat A');
      this.engine.cancelLoop();
    }
  }

  private applyScale(): void {
    if (!this.dom) return;
    const targetStyle = this.engine.getTargetStyle();
    const nativeStyle = this.engine.getNativeStyle();
    const clusterSettings = this.engine.getClusterSettings();
    const blockSettings = this.engine.getBlockSettings();

    const containerRect = this.container.getBoundingClientRect();
    const rect =
      containerRect.width > 0 && containerRect.height > 0
        ? containerRect
        : this.video.getBoundingClientRect();
    const snap = computeScaleSnapshot(
      rect.width,
      rect.height,
      targetStyle,
      nativeStyle,
      clusterSettings.buttonSize,
      blockSettings.globalScale,
    );
    const enabled = clusterSettings.enabled;
    const clusterWidth = enabled ? snap.clusterWidth : 0;
    this.dom.block.style.setProperty('--sb-target-font', `${snap.targetFontSize}px`);
    this.dom.block.style.setProperty('--sb-native-font', `${snap.nativeFontSize}px`);
    this.dom.block.style.setProperty('--sb-btn-size', `${snap.buttonSize}px`);
    this.dom.block.style.setProperty('--sb-text-opacity', String(clusterSettings.textOpacity));
    this.dom.block.style.setProperty('--sb-bg-opacity', String(clusterSettings.bgOpacity));
    this.dom.block.style.setProperty('--sb-cluster-width', `${clusterWidth}px`);
    this.container.style.setProperty('--sb-btn-size', `${snap.buttonSize}px`);
    this.container.style.setProperty('--sb-text-opacity', String(clusterSettings.textOpacity));
    this.container.style.setProperty('--sb-bg-opacity', String(clusterSettings.bgOpacity));
    const watchVideo = document.querySelector('.watch-video');
    if (watchVideo instanceof HTMLElement) {
      watchVideo.style.setProperty('--sb-btn-size', `${snap.buttonSize}px`);
      watchVideo.style.setProperty('--sb-text-opacity', String(clusterSettings.textOpacity));
      watchVideo.style.setProperty('--sb-bg-opacity', String(clusterSettings.bgOpacity));
    }
  }

  private render(): void {
    if (!this.dom) return;
    const targetStyle = this.engine.getTargetStyle();
    const nativeStyle = this.engine.getNativeStyle();
    const targetText = this.getCurrentTargetText();
    const nativeText = this.getCurrentNativeText();
    this.dom.targetLine.textContent = targetStyle.visible ? targetText : '';
    this.dom.targetLine.style.display = targetStyle.visible && targetText ? 'block' : 'none';
    this.dom.nativeLine.textContent = nativeStyle.visible ? nativeText : '';
    this.dom.nativeLine.style.display = nativeStyle.visible && nativeText ? 'block' : 'none';

    if (this.tokenizeController) {
      const { target, native } = this.engine.getActiveIndices();
      this.tokenizeController.render(target, native);
      return;
    }

    if (this.engine.isDictionaryPopupEnabled() && targetStyle.visible && targetText) {
      this.wrapTargetLineTokens(targetText);
    }
  }

  private wrapTargetLineTokens(text: string): void {
    if (!this.dom) return;
    const langCode = detectLangCode(text);
    const tempSpan = document.createElement('span');
    tempSpan.textContent = text;
    const tokenSpans = wrapTokenSpans(tempSpan, text, langCode);
    this.dom.targetLine.textContent = '';
    while (tempSpan.firstChild) {
      this.dom.targetLine.appendChild(tempSpan.firstChild);
    }
    if (this.dpTriggerController) {
      this.dpTriggerController.detach();
      if (tokenSpans.length > 0) {
        this.dpTriggerController.attach(tokenSpans, text, langCode);
      }
    }
  }

  private wireDrag(): void {
    if (!this.dom) return;
    this.dragCleanup = wireBlockDrag(this.dom.block, this.container, {
      getYOffset: () => this.engine.getBlockSettings().yOffsetPercent,
      setYOffset: (value) => this.setYOffset(value),
      onEnd: (value) => {
        this.setYOffset(value);
        this.persist({ yOffsetPercent: value });
      },
    });
  }

  private setYOffset(value: number): void {
    this.engine.updateBlockSettings({ yOffsetPercent: value });
    if (this.dom) {
      this.dom.block.style.setProperty('--sb-top', `${this.engine.getBlockSettings().yOffsetPercent}%`);
    }
  }

  updateBlockSettings(partial: Partial<SubtitleBlockSettings>): void {
    this.engine.updateBlockSettings(partial);
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
    this.dom.prevBtn.addEventListener('click', () => this.engine.handlePrev());
    this.dom.nextBtn.addEventListener('click', () => this.engine.handleNext());
    this.dom.rewindBtn.addEventListener('click', () => this.engine.handleRewind());
    this.dom.forwardBtn.addEventListener('click', () => this.engine.handleForward());
    this.dom.playPauseBtn.addEventListener('click', () => this.engine.handlePlayPause());
    this.syncPlayPauseIcon();
    this.onVideoPlay = () => this.syncPlayPauseIcon();
    this.onVideoPause = () => this.syncPlayPauseIcon();
    this.video.addEventListener('play', this.onVideoPlay);
    this.video.addEventListener('pause', this.onVideoPause);
    this.dom.repeatBtn.addEventListener('click', () => this.handleRepeatClick());
    this.dom.quickUpdateBtn.addEventListener('click', () => this.onCardCreatorAction('quick-update'));
    this.dom.editCardBtn.addEventListener('click', () => this.onCardCreatorAction('edit-card'));
    this.dom.updateCurrentCardBtn.addEventListener('click', () => this.onUpdateCurrentCard());
    this.dom.generateNativeBtn.addEventListener('click', () => this.onGenerateNative());
    this.dom.moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMorePopover();
    });
  }

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
    if (this.engine.hasSubtitles()) {
      this.engine.repeatOnce();
      return;
    }
    const state = this.engine.handleNoSubRepeatClick();
    this.setRepeatIcon(state.icon, state.label);
  }

  private setRepeatIcon(icon: NavClusterIconName, label?: string): void {
    if (!this.dom) return;
    const html = NAV_CLUSTER_ICONS[icon];
    if (html) this.dom.repeatBtn.innerHTML = html;
    if (label) this.dom.repeatBtn.setAttribute('aria-label', label);
  }

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
      if (isNetflixPage()) {
        this.applyScale();
        this.syncPosition();
        return;
      }
      const fsElement = document.fullscreenElement as HTMLElement | null;
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
    this.video.addEventListener('timeupdate', this.engine.onTimeUpdate);
  }

  private startResizeObserver(): void {
    this.resizeObserver = createBlockScaleObserver(this.container, () => {
      this.applyScale();
      this.syncPosition();
    });
  }

  setOffsetProvider(provider: () => number): void {
    this.engine.setOffsetProvider(provider);
  }

  updateSettings(update: SubtitleBlockControllerUpdate): void {
    this.engine.updateSettings(update as SubtitleCueEngineUpdate);
  }

  loadCues(cues: SrtCue[]): void {
    this.engine.loadCues(cues);
  }

  loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
    this.engine.loadBilingualCues(targetCues, nativeCues);
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

  private setGenerateNativeButtonEnabled(enabled: boolean): void {
    if (!this.dom) return;
    this.dom.generateNativeBtn.disabled = !enabled;
    this.dom.generateNativeBtn.setAttribute('aria-disabled', String(!enabled));
  }

  clearCues(): void {
    this.engine.clearCues();
  }

  destroy(): void {
    this.video.removeEventListener('timeupdate', this.engine.onTimeUpdate);
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
    if (this.dpTriggerController) {
      this.dpTriggerController.detach();
      this.dpTriggerController = null;
    }
    if (this.tokenizeController) {
      this.tokenizeController.destroy();
      this.tokenizeController = null;
    }
  }

  enableDictionaryPopup(
    triggerMode: TriggerMode,
    onLookup: (request: LookupRequest, requestId: string, anchorRect: DOMRect, highlightTarget: HTMLSpanElement) => void,
    onCancel: (requestId: string) => void,
    onClear?: () => void,
  ): void {
    this.engine.enableDictionaryPopup({ triggerMode, onLookup, onCancel, onClear });
    if (!this.dpTriggerController) {
      this.dpTriggerController = new SubtitleTriggerController({
        triggerMode,
        onLookup,
        onCancel,
        onClear,
      });
    } else {
      this.dpTriggerController.setTriggerMode(triggerMode);
    }
    this.render();
  }

  disableDictionaryPopup(): void {
    this.engine.disableDictionaryPopup();
    if (this.dpTriggerController) {
      this.dpTriggerController.detach();
    }
    this.render();
  }

  setDictionaryPopupTriggerMode(mode: TriggerMode): void {
    this.engine.setDictionaryPopupTriggerMode(mode);
    if (this.dpTriggerController) {
      this.dpTriggerController.setTriggerMode(mode);
    }
  }

  isDictionaryPopupEnabled(): boolean {
    return this.engine.isDictionaryPopupEnabled();
  }

  enableTokenize(
    options: Pick<SubtitleTokenizeControllerOptions, 'onOpenDictionary' | 'langCode' | 'windowSize'>,
  ): void {
    this.engine.enableTokenize(options as SubtitleCueEngineTokenizeOptions);
    if (this.tokenizeController) {
      this.tokenizeController.destroy();
    }
    this.tokenizeController = createSubtitleTokenizeController({
      ...options,
      getLineElements: () => ({ target: this.dom?.targetLine ?? null, native: this.dom?.nativeLine ?? null }),
    });
    this.tokenizeController.setCues(this.engine.getTargetCues(), this.engine.getNativeCues());
    this.tokenizeController.enable();
    this.render();
  }

  disableTokenize(): void {
    this.engine.disableTokenize();
    if (this.tokenizeController) {
      this.tokenizeController.destroy();
      this.tokenizeController = null;
    }
    this.render();
  }

  setTokenizeShowStatus(show: boolean): void {
    this.tokenizeController?.setShowStatus(show);
  }

  setTokenizeShowFrequency(show: boolean): void {
    this.tokenizeController?.setShowFrequency(show);
  }

  isTokenizeEnabled(): boolean {
    return this.engine.isTokenizeEnabled();
  }
}
