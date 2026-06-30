import {
  createOverlayLayer,
  applyStyle,
  updateOverlayText,
  hideOverlay,
  removeOverlay,
} from './subtitleUI';
import { createImportButton } from './subtitleImport';
import { createDragHandle } from './subtitleDragPosition';
import { findCurrentLine } from './subtitleSync';
import type { OverlayConfig, OverlayStyleConfig } from '../types/subtitle';
import type { SrtCue } from '../types/media';

/**
 * SubtitleOverlayController — orchestrator that connects sync logic to overlay UI.
 *
 * ADR-013: 2 overlay layer độc lập (target + native), mỗi cái 1 div + drag handle.
 * - Bilingual mode: 2 binary searches → 2 updateOverlayText (target + native div riêng)
 * - Single mode (legacy drag-drop): target overlay only, native hidden
 *
 * Wires:
 * - video.timeupdate event → findCurrentLine (binary search) → update overlay
 * - import button → file picker → loadCues (caller wires drag-drop separately)
 * - chrome.storage.onChanged → updateStyle (realtime appearance, ADR-013 D3)
 *
 * Lifecycle: init() → loadCues(cues) | loadBilingualCues(t, n) →
 *   (timeupdate auto-syncs) → updateStyle() (realtime) → destroy()
 *
 * Contract (kept for AutoLoadController interface, ADR-007 không break):
 * - loadBilingualCues(targetCues, nativeCues)
 * - loadCues(cues)
 * - clearCues()
 * - destroy()
 */
export class SubtitleOverlayController {
  private targetOverlay: HTMLDivElement | null = null;
  private nativeOverlay: HTMLDivElement | null = null;
  public importButton: HTMLButtonElement | null = null;
  private cues: SrtCue[] = [];
  private nativeCues: SrtCue[] = [];
  private lastIndex: number = -1;
  private lastNativeIndex: number = -1;
  private bilingual: boolean = false;
  private targetStyle: OverlayStyleConfig;
  private nativeStyle: OverlayStyleConfig;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly config: OverlayConfig,
    targetStyle: OverlayStyleConfig,
    nativeStyle: OverlayStyleConfig,
  ) {
    this.targetStyle = targetStyle;
    this.nativeStyle = nativeStyle;
  }

  /**
   * Create 2 overlay layer (target + native) + import button, attach timeupdate listener.
   *
   * @param videoWrapper - Container for the video + extension UI. If omitted,
   * falls back to video.parentElement (legacy callers / tests).
   */
  init(videoWrapper?: HTMLElement): void {
    const container = videoWrapper ?? this.video.parentElement ?? document.body;
    const target = createOverlayLayer('target', this.targetStyle, container);
    const native = createOverlayLayer('native', this.nativeStyle, container);
    this.targetOverlay = target.overlay;
    this.nativeOverlay = native.overlay;

    // Wire drag handles → updateStyle position + persist (debounced in createDragHandle)
    const containerForDrag = container;
    createDragHandle(this.targetOverlay, containerForDrag, this.targetStyle.yOffsetPercent, (newOffset) => {
      this.targetStyle = { ...this.targetStyle, yOffsetPercent: newOffset };
      this.persistStyle('target');
    });
    createDragHandle(this.nativeOverlay, containerForDrag, this.nativeStyle.yOffsetPercent, (newOffset) => {
      this.nativeStyle = { ...this.nativeStyle, yOffsetPercent: newOffset };
      this.persistStyle('native');
    });

    // Import button is created by content-script and passed to the manager panel
    // toolbar; kept here for backwards-compat callers that don't wire the panel.
    this.importButton = createImportButton(container, this.config);
    this.video.addEventListener('timeupdate', this.onTimeUpdate);
  }

  /**
   * Load parsed cues and start syncing (single-line mode, backward compat).
   * Target overlay shows cues, native overlay hidden.
   */
  loadCues(cues: SrtCue[]): void {
    this.cues = cues;
    this.nativeCues = [];
    this.bilingual = false;
    this.lastIndex = -1;
    this.lastNativeIndex = -1;
    // Hide native overlay in single mode
    if (this.nativeOverlay) {
      this.nativeOverlay.style.display = 'none';
    }
  }

  /**
   * Load target + native cues for bilingual runtime align (ADR-007 D1).
   * Each `timeupdate` runs 2 independent binary searches (`findCurrentLine`)
   * — n ~ 1000 cues, 4 fires/sec, no degrade (spec NF5).
   * ADR-013: output tách 2 div độc lập (thay 2 span trong 1 div).
   * ADR-014 D1: merge thay ghi đè — giữ cues cũ khi side mới rỗng (bug A fix).
   * Multiple AUTO_LOAD_SUBTITLES push (onMediaDetected incremental + REQUEST re-push)
   * có thể gửi 1 side null → ghi đè unconditionally clear cues cũ. Merge giữ cues cũ.
   */
  loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
    if (targetCues.length > 0) this.cues = targetCues;
    if (nativeCues.length > 0) this.nativeCues = nativeCues;
    this.bilingual = true;
    this.lastIndex = -1;
    this.lastNativeIndex = -1;
  }

  /**
   * Clear cues and hide both overlays.
   */
  clearCues(): void {
    this.cues = [];
    this.nativeCues = [];
    this.bilingual = false;
    this.lastIndex = -1;
    this.lastNativeIndex = -1;
    if (this.targetOverlay) hideOverlay(this.targetOverlay);
    if (this.nativeOverlay) hideOverlay(this.nativeOverlay);
  }

  /**
   * Update appearance style for one or both overlays (ADR-013 D3).
   * Called by content-script chrome.storage.onChanged listener.
   * O(1) set inline style, không recreate DOM.
   */
  updateStyle(targetStyle?: OverlayStyleConfig, nativeStyle?: OverlayStyleConfig): void {
    if (targetStyle && this.targetOverlay) {
      this.targetStyle = targetStyle;
      applyStyle(targetStyle, this.targetOverlay);
    }
    if (nativeStyle && this.nativeOverlay) {
      this.nativeStyle = nativeStyle;
      applyStyle(nativeStyle, this.nativeOverlay);
    }
  }

  /**
   * timeupdate handler: binary search current cue(s), update overlay only on change.
   * Bilingual mode: 2 binary searches (target + native), update only when either changes.
   * ADR-013: 2 updateOverlayText (target + native div riêng, thay updateOverlayBilingual).
   */
  private onTimeUpdate = (): void => {
    if (!this.targetOverlay || !this.nativeOverlay) return;
    if (this.cues.length === 0 && this.nativeCues.length === 0) return;

    // video.currentTime is in seconds, cues are in milliseconds
    const currentTimeMs = this.video.currentTime * 1000;

    if (this.bilingual) {
      const index = findCurrentLine(this.cues, currentTimeMs);
      const nativeIndex = findCurrentLine(this.nativeCues, currentTimeMs);
      if (index === this.lastIndex && nativeIndex === this.lastNativeIndex) return;
      this.lastIndex = index;
      this.lastNativeIndex = nativeIndex;

      // Target overlay
      const targetText = index >= 0 ? this.cues[index].text : '';
      if (targetText) {
        updateOverlayText(this.targetOverlay, targetText);
      } else {
        hideOverlay(this.targetOverlay);
      }

      // Native overlay (respect visible flag — applyStyle handles display)
      const nativeText = nativeIndex >= 0 ? this.nativeCues[nativeIndex].text : '';
      if (nativeText && this.nativeStyle.visible) {
        updateOverlayText(this.nativeOverlay, nativeText);
      } else {
        hideOverlay(this.nativeOverlay);
      }
      return;
    }

    // Single mode: target overlay only
    if (this.cues.length === 0) return;
    const index = findCurrentLine(this.cues, currentTimeMs);
    if (index !== this.lastIndex) {
      this.lastIndex = index;
      if (index >= 0) {
        updateOverlayText(this.targetOverlay, this.cues[index].text);
      } else {
        hideOverlay(this.targetOverlay);
      }
    }
  };

  /**
   * Persist style to chrome.storage (called by drag handle onDrag callback).
   * ponytail: direct chrome.storage.set — popupStore.updateSettings also sets,
   * but drag happens in content script (no popup open), so persist directly.
   */
  private persistStyle(role: 'target' | 'native'): void {
    try {
      void chrome.storage.local.get('settings').then((result) => {
        const settings = result.settings ?? {};
        const updated = {
          ...settings,
          [role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle']:
            role === 'target' ? this.targetStyle : this.nativeStyle,
        };
        void chrome.storage.local.set({ settings: updated });
      });
    } catch {
      // ponytail: storage might not be available in test contexts — ignore
    }
  }

  /**
   * Remove both overlays, button, and event listener. Clean up DOM.
   */
  destroy(): void {
    this.video.removeEventListener('timeupdate', this.onTimeUpdate);
    if (this.targetOverlay) {
      removeOverlay(this.targetOverlay);
      this.targetOverlay = null;
    }
    if (this.nativeOverlay) {
      removeOverlay(this.nativeOverlay);
      this.nativeOverlay = null;
    }
    if (this.importButton) {
      this.importButton.remove();
      this.importButton = null;
    }
    this.cues = [];
    this.nativeCues = [];
    this.lastIndex = -1;
    this.lastNativeIndex = -1;
    this.bilingual = false;
  }
}
