/**
 * Manages the lifecycle of the offscreen document that runs ffmpeg.wasm.
 *
 * MV3 service workers cannot execute WebAssembly, so all ffmpeg.wasm work is
 * delegated to an offscreen document (`src/offscreen/ffmpeg.html`). This class
 * lazily creates that document on demand and closes it when no longer needed.
 */

/** URL of the offscreen document relative to the extension root. */
const OFFSCREEN_DOCUMENT_URL = 'src/offscreen/ffmpeg.html';

/** Human-readable justification supplied to the Chrome API. */
const JUSTIFICATION =
  'Run ffmpeg.wasm to convert merged .ts segments into .mp4; service workers cannot execute WebAssembly.';

/**
 * Wraps `chrome.offscreen` to create and close the offscreen document that
 * hosts ffmpeg.wasm.
 */
export class OffscreenManager {
  private documentExists = false;

  /**
   * Ensure the offscreen document exists, creating it if necessary.
   *
   * Uses `chrome.offscreen.hasDocument()` (when available) to avoid creating a
   * duplicate document, then falls back to `createDocument`. The existence flag
   * is also tracked in memory so repeated calls are cheap.
   */
  async ensureOffscreenDocument(): Promise<void> {
    if (this.documentExists) {
      return;
    }

    // `hasDocument` may not exist in older Chrome versions; guard accordingly.
    const offscreen = chrome.offscreen;
    if (typeof offscreen?.hasDocument === 'function') {
      const hasDocument = await offscreen.hasDocument();
      if (hasDocument) {
        this.documentExists = true;
        return;
      }
    }

    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_URL,
      reasons: [
        chrome.offscreen.Reason.WORKERS,
        chrome.offscreen.Reason.BLOBS,
      ],
      justification: JUSTIFICATION,
    });

    this.documentExists = true;
  }

  /**
   * Close the offscreen document if it currently exists.
   *
   * Safe to call even when no document has been created.
   */
  async closeOffscreenDocument(): Promise<void> {
    if (!this.documentExists) {
      return;
    }

    await chrome.offscreen.closeDocument();
    this.documentExists = false;
  }

  /**
   * Whether the offscreen document is currently believed to exist.
   */
  hasDocument(): boolean {
    return this.documentExists;
  }
}
