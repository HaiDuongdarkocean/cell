/**
 * Manages the lifecycle of the offscreen document that runs ffmpeg.wasm.
 *
 * MV3 service workers cannot execute WebAssembly, so all ffmpeg.wasm work is
 * delegated to an offscreen document (`src/entrypoints/offscreen/ffmpeg.html`). This class
 * lazily creates that document on demand and closes it when no longer needed.
 */

import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  createOffscreenDocument,
  hasOffscreenDocument,
  closeOffscreenDocument,
  getOffscreenReasons,
  sendMessage,
} from '@/shared/lib/chrome-apis';

/** URL of the offscreen document relative to the extension root. */
const OFFSCREEN_DOCUMENT_URL = 'src/entrypoints/offscreen/ffmpeg.html';

/** Human-readable justification supplied to the Chrome API. */
const JUSTIFICATION =
  'Run ffmpeg.wasm to convert merged .ts segments into .mp4; service workers cannot execute WebAssembly.';

/** Max retries for the offscreen ping handshake. */
const PING_MAX_RETRIES = 20;

/** Delay between ping retries (ms). */
const PING_RETRY_DELAY_MS = 100;

/**
 * Wraps `chrome.offscreen` to create and close the offscreen document that
 * hosts ffmpeg.wasm.
 */
export class OffscreenManager {
  private documentExists = false;
  private listenerReady = false;

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
      const hasDocument = await hasOffscreenDocument();
      if (hasDocument) {
        this.documentExists = true;
        return;
      }
    }

    const reasons = getOffscreenReasons();
    await createOffscreenDocument(
      OFFSCREEN_DOCUMENT_URL,
      [
        reasons.WORKERS,
        reasons.BLOBS,
      ],
      JUSTIFICATION,
    );

    this.documentExists = true;
  }

  /**
   * Ensure the offscreen document exists AND its message listener is ready.
   *
   * `chrome.offscreen.createDocument()` resolves as soon as the document is
   * created, but the document's script may not have finished loading yet.
   * Sending a message before the listener registers fails with
   * "Could not establish connection. Receiving end does not exist."
   *
   * This method does a ping-pong handshake: sends `OFFSCREEN_PING` and retries
   * until the offscreen responds, confirming the listener is registered.
   */
  async ensureOffscreenReady(): Promise<void> {
    if (this.listenerReady) {
      return;
    }

    await this.ensureOffscreenDocument();

    for (let attempt = 0; attempt < PING_MAX_RETRIES; attempt++) {
      try {
        const response = await sendMessage<{ success?: boolean }>({
          type: MESSAGE_TYPES.OFFSCREEN_PING,
        });
        if (response?.success) {
          this.listenerReady = true;
          console.log(
            `[offscreen-manager] Listener ready after ${attempt + 1} ping(s)`,
          );
          return;
        }
      } catch (err) {
        // "Could not establish connection" — listener not ready yet, retry.
        console.log(
          `[offscreen-manager] Ping attempt ${attempt + 1} failed:`,
          err instanceof Error ? err.message : err,
        );
      }
      await sleep(PING_RETRY_DELAY_MS);
    }

    throw new Error(
      `Offscreen document did not respond to ping after ${PING_MAX_RETRIES} attempts. ` +
        'The listener may have failed to register.',
    );
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

    await closeOffscreenDocument();
    this.documentExists = false;
    this.listenerReady = false;
  }

  /**
   * Whether the offscreen document is currently believed to exist.
   */
  hasDocument(): boolean {
    return this.documentExists;
  }
}

/** Promise-based sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

