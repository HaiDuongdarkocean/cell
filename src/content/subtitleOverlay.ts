import { createOverlay, updateOverlayText, updateOverlayBilingual, hideOverlay, removeOverlay } from './subtitleUI';
import { createImportButton } from './subtitleImport';
import { findCurrentLine } from './subtitleSync';
import type { OverlayConfig } from '../types/subtitle';
import type { SrtCue } from '../types/media';

/**
 * SubtitleOverlayController — orchestrator that connects sync logic to overlay UI.
 *
 * Two modes:
 * - Single (legacy drag-drop): `loadCues(cues)` → 1 binary search → `updateOverlayText`
 * - Bilingual (auto-load): `loadBilingualCues(target, native)` → 2 binary searches
 *   → `updateOverlayBilingual` (target on top, native below, ADR-007 D1)
 *
 * Wires:
 * - video.timeupdate event → findCurrentLine (binary search) → update overlay
 * - import button → file picker → loadCues (caller wires drag-drop separately)
 *
 * Lifecycle: init() → loadCues(cues) | loadBilingualCues(t, n) → (timeupdate auto-syncs) → destroy()
 */
export class SubtitleOverlayController {
  private overlay: HTMLDivElement | null = null;
  private importButton: HTMLButtonElement | null = null;
  private cues: SrtCue[] = [];
  private nativeCues: SrtCue[] = [];
  private lastIndex: number = -1;
  private lastNativeIndex: number = -1;
  private bilingual: boolean = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly config: OverlayConfig,
  ) {}

  /**
   * Create overlay + import button, attach timeupdate listener.
   */
  init(): void {
    this.overlay = createOverlay(this.video, this.config);
    this.importButton = createImportButton(this.video, this.config);
    this.video.addEventListener('timeupdate', this.onTimeUpdate);
  }

  /**
   * Load parsed cues and start syncing (single-line mode, backward compat).
   */
  loadCues(cues: SrtCue[]): void {
    this.cues = cues;
    this.nativeCues = [];
    this.bilingual = false;
    this.lastIndex = -1;
    this.lastNativeIndex = -1;
  }

  /**
   * Load target + native cues for bilingual runtime align (ADR-007 D1).
   * Each `timeupdate` runs 2 independent binary searches (`findCurrentLine`)
   * — n ~ 1000 cues, 4 fires/sec, no degrade (spec NF5).
   */
  loadBilingualCues(targetCues: SrtCue[], nativeCues: SrtCue[]): void {
    this.cues = targetCues;
    this.nativeCues = nativeCues;
    this.bilingual = true;
    this.lastIndex = -1;
    this.lastNativeIndex = -1;
  }

  /**
   * Clear cues and hide overlay.
   */
  clearCues(): void {
    this.cues = [];
    this.nativeCues = [];
    this.bilingual = false;
    this.lastIndex = -1;
    this.lastNativeIndex = -1;
    if (this.overlay) hideOverlay(this.overlay);
  }

  /**
   * timeupdate handler: binary search current cue(s), update overlay only on change.
   * Bilingual mode: 2 binary searches (target + native), update only when either changes.
   */
  private onTimeUpdate = (): void => {
    if (!this.overlay) return;
    if (this.cues.length === 0 && this.nativeCues.length === 0) return;

    // video.currentTime is in seconds, cues are in milliseconds
    const currentTimeMs = this.video.currentTime * 1000;

    if (this.bilingual) {
      const index = findCurrentLine(this.cues, currentTimeMs);
      const nativeIndex = findCurrentLine(this.nativeCues, currentTimeMs);
      if (index === this.lastIndex && nativeIndex === this.lastNativeIndex) return;
      this.lastIndex = index;
      this.lastNativeIndex = nativeIndex;
      const targetText = index >= 0 ? this.cues[index].text : '';
      const nativeText = nativeIndex >= 0 ? this.nativeCues[nativeIndex].text : '';
      if (!targetText && !nativeText) {
        hideOverlay(this.overlay);
      } else {
        updateOverlayBilingual(this.overlay, targetText, nativeText);
      }
      return;
    }

    if (this.cues.length === 0) return;
    const index = findCurrentLine(this.cues, currentTimeMs);
    if (index !== this.lastIndex) {
      this.lastIndex = index;
      if (index >= 0) {
        updateOverlayText(this.overlay, this.cues[index].text);
      } else {
        hideOverlay(this.overlay);
      }
    }
  };

  /**
   * Remove overlay, button, and event listener. Clean up DOM.
   */
  destroy(): void {
    this.video.removeEventListener('timeupdate', this.onTimeUpdate);
    if (this.overlay) {
      removeOverlay(this.overlay);
      this.overlay = null;
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
