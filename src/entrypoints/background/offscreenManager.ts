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
  // In-flight promise for `ensureOffscreenDocument` — when multiple callers
  // request the document concurrently (e.g. several
  // `resolveUnknownSubtitleLanguages` fetches running in parallel), they all
  // share the same creation promise. Without this, each caller sees
  // `documentExists=false` and calls `createOffscreenDocument` independently
  // → "Only a single offscreen document may be created" error.
  private documentPromise: Promise<void> | null = null;
  // In-flight promise for `ensureOffscreenReady` — same race, but for the
  // ping handshake. Multiple callers sharing one handshake avoids duplicate
  // ping storms.
  private readyPromise: Promise<void> | null = null;

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
    if (this.documentPromise) {
      return this.documentPromise;
    }
    this.documentPromise = this.doEnsureOffscreenDocument();
    try {
      await this.documentPromise;
    } finally {
      this.documentPromise = null;
    }
  }

  private async doEnsureOffscreenDocument(): Promise<void> {
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
    if (this.readyPromise) {
      return this.readyPromise;
    }
    this.readyPromise = this.doEnsureOffscreenReady();
    try {
      await this.readyPromise;
    } finally {
      this.readyPromise = null;
    }
  }

  private async doEnsureOffscreenReady(): Promise<void> {
    await this.ensureOffscreenDocument();

    for (let attempt = 0; attempt < PING_MAX_RETRIES; attempt++) {
      try {
        const response = await sendMessage<{ success?: boolean }>({
          type: MESSAGE_TYPES.OFFSCREEN_PING,
        });
        if (response?.success) {
          this.listenerReady = true;
          return;
        }
      } catch {
        // "Could not establish connection" — listener not ready yet, retry.
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

