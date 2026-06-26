import { createOverlay, updateOverlayText, hideOverlay, removeOverlay } from './subtitleUI';
import { createImportButton } from './subtitleImport';
import { findCurrentLine } from './subtitleSync';
import type { OverlayConfig } from '../types/subtitle';
import type { SrtCue } from '../types/media';

/**
 * SubtitleOverlayController — orchestrator that connects sync logic to overlay UI.
 *
 * Wires:
 * - video.timeupdate event → findCurrentLine (binary search) → updateOverlayText/hideOverlay
 * - import button → file picker → loadCues (caller wires drag-drop separately)
 *
 * Lifecycle: init() → loadCues(cues) → (timeupdate auto-syncs) → destroy()
 */
export class SubtitleOverlayController {
  private overlay: HTMLDivElement | null = null;
  private importButton: HTMLButtonElement | null = null;
  private cues: SrtCue[] = [];
  private lastIndex: number = -1;

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
   * Load parsed cues and start syncing.
   */
  loadCues(cues: SrtCue[]): void {
    this.cues = cues;
    this.lastIndex = -1;
  }

  /**
   * Clear cues and hide overlay.
   */
  clearCues(): void {
    this.cues = [];
    this.lastIndex = -1;
    if (this.overlay) hideOverlay(this.overlay);
  }

  /**
   * timeupdate handler: binary search current cue, update overlay only on change.
   */
  private onTimeUpdate = (): void => {
    if (!this.overlay || this.cues.length === 0) return;

    // video.currentTime is in seconds, cues are in milliseconds
    const currentTimeMs = this.video.currentTime * 1000;
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
    this.lastIndex = -1;
  }
}
