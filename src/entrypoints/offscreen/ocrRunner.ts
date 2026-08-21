// ocrRunner — offscreen document script for OCR (spec §AD2, §AD5).
// Runs alongside ffmpegRunner.ts in the same offscreen document (ffmpeg.html).
// Handles OCR_INIT / OCR_RECOGNIZE / OCR_DISPOSE messages from background.
// OCR_DISPOSE frees the engine — does NOT close the offscreen document (ffmpeg may be running).

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { getURL } from '@/shared/lib/chrome-apis';
import { PaddleOcrEngine } from '@/features/ocr/engine/paddleOcrEngine';
import type { OcrEngine } from '@/features/ocr/engine/ocrEngine';
import type { ImageSource, OcrResult, OcrConfig, OcrBackend } from '@/features/ocr/engine/types';

// Debug: forward offscreen errors to background via chrome.runtime.sendMessage.
// chrome.storage.local.set fails silently in offscreen documents, so we use
// sendMessage to reach the background, which CAN write to chrome.storage.local.
// NOTE: chrome.runtime.sendMessage from offscreen does NOT reach content scripts
// (Chrome limitation — must use chrome.tabs.sendMessage for content scripts).
function debugBroadcast(data: Record<string, unknown>): void {
  try {
    void chrome.runtime.sendMessage({ type: 'OFFSCREEN_DEBUG_LOG', data: { ...data, time: Date.now() } }).catch(() => {});
  } catch {}
}
// Expose globally so patched OpenCV closures can call it.
(self as unknown as Record<string, unknown>).__debugBroadcast = debugBroadcast;

// Debug: catch ALL errors in offscreen document (including CSP EvalError).
// CSP errors don't throw in try-catch — they fire as window.onerror events.
// Without this, the EvalError from OpenCV/ORT is silent and OCR_INIT just fails.
(self as unknown as { onerror: (msg: string, src: string, line: number, col: number, err: Error) => void }).onerror = (msg, src, line, col, err) => {
  console.error('[OFFSCREEN-ONERROR]', { msg, src, line, col, err });
  debugBroadcast({
    kind: 'onerror',
    msg: String(msg)?.slice(0, 300),
    src: String(src)?.slice(0, 200),
    line, col,
    stack: err?.stack?.slice(0, 1000) ?? String(err)?.slice(0, 500),
  });
};

// Debug: verify script load + chrome.storage work in offscreen document.
console.log('[OCR] ocrRunner.ts script loaded');
try {
  document.title = 'OCR_SCRIPT_LOADED';
  chrome.storage.local.set({ __ocrScriptLoadTime: Date.now() }).catch((e: unknown) => {
    console.error('[OCR] chrome.storage.local.set rejected for __ocrScriptLoadTime:', e);
  });
} catch (e) {
  // If chrome.storage doesn't work in offscreen, this is the root cause.
  console.error('[OCR] chrome.storage.local.set threw for __ocrScriptLoadTime:', e);
  document.title = 'OCR_STORAGE_FAIL:' + String(e)?.slice(0, 50);
}

/** OCR message payloads. */
interface OcrInitPayload {
  readonly languageMode: OcrConfig['languageMode'];
  readonly backend: OcrBackend;
}

interface OcrRecognizePayload {
  readonly image: ImageSource;
  readonly minScore?: number;
}

interface OcrInitResult {
  readonly status: 'ready' | 'error';
  readonly backend: OcrBackend;
  readonly error?: string;
}

interface OcrRecognizeResult {
  readonly results: OcrResult[];
}

/** Singleton OCR engine — lives in offscreen document. */
let engine: OcrEngine | null = null;
let currentBackend: OcrBackend | null = null;

/** Default wasmPaths — bundled in extension assets/ (Vite output).
 *  Extension root is dist/, so chrome.runtime.getURL('assets/') resolves
 *  to chrome-extension://<id>/assets/ where Vite outputs .wasm files.
 *  Vite hashes wasm filenames (ort-wasm-simd-threaded.jsep-<hash>.wasm) so
 *  we point to the assets directory; ORT resolves the exact filename. */
function defaultWasmPaths(): string {
  return getURL('assets/');
}

/** Message listener for OCR messages. */
export function ocrMessageListener(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | undefined {
  // Debug: log EVERY message received by OCR listener (before any processing).
  console.log('[OCR-LISTENER] ocrMessageListener called', { type: (message as { type?: string })?.type });
  debugBroadcast({ kind: 'listener', type: (message as { type?: string })?.type ?? 'no-type' });
  const msg = message as { type?: string };
  if (!msg.type) return;

  switch (msg.type) {
    case MESSAGE_TYPES.OCR_INIT: {
      const payload = (msg as unknown as { payload?: OcrInitPayload }).payload ?? (msg as unknown as OcrInitPayload);
      void handleOcrInit(payload)
        .then(sendResponse)
        .catch((e: unknown) => sendResponse({ status: 'error', backend: 'wasm', error: String(e) }));
      return true; // async response
    }

    case MESSAGE_TYPES.OCR_RECOGNIZE: {
      const payload = (msg as unknown as { payload?: OcrRecognizePayload }).payload ?? (msg as unknown as OcrRecognizePayload);
      void handleOcrRecognize(payload)
        .then(sendResponse)
        .catch((e: unknown) => sendResponse({ error: String(e) }));
      return true;
    }

    case MESSAGE_TYPES.OCR_DISPOSE:
      void handleOcrDispose().then(sendResponse).catch((e: unknown) => sendResponse({ error: String(e) }));
      return true;
  }
}

async function handleOcrInit(payload: OcrInitPayload): Promise<OcrInitResult & { debug?: unknown }> {
  const dbg = (msg: string) => {
    console.log('[OCR-INIT]', msg);
    debugBroadcast({ kind: 'init-progress', msg });
  };
  dbg('start');
  console.log('[OCR] handleOcrInit start', { languageMode: payload.languageMode, backend: payload.backend, engineExists: !!engine });
  if (engine?.isInitialized()) {
    dbg('already-initialized');
    return { status: 'ready', backend: currentBackend ?? payload.backend };
  }
  if (engine) {
    dbg('dispose-existing');
    try { await engine.dispose(); } catch {}
    engine = null;
  }
  // Force WASM backend — WebGPU hangs in offscreen documents (no GPU rendering context).
  // ORT's WebGPU backend waits indefinitely for a GPU adapter that never initializes.
  // WASM is reliable in offscreen documents and fast enough with SIMD.
  const effectiveBackend: OcrBackend = 'wasm';
  engine = new PaddleOcrEngine();
  const config: OcrConfig = {
    languageMode: payload.languageMode,
    backend: effectiveBackend,
    wasmPaths: defaultWasmPaths(),
  };
  try {
    dbg('init-call:' + effectiveBackend);
    await engine.initialize(config);
    dbg('init-done:' + engine.isInitialized());
    currentBackend = effectiveBackend;
    return { status: 'ready', backend: currentBackend, debug: { engineInitialized: engine.isInitialized(), effectiveBackend } };
  } catch (e) {
    dbg('init-error:' + effectiveBackend + ':' + String(e)?.slice(0, 100));
    engine = null;
    return { status: 'error', backend: effectiveBackend, error: String(e) };
  }
}

async function handleOcrRecognize(payload: OcrRecognizePayload): Promise<OcrRecognizeResult> {
  console.log('[OCR] handleOcrRecognize start', { engineExists: !!engine, engineInitialized: engine?.isInitialized() });
  if (!engine) throw new Error('OCR engine not initialized — send OCR_INIT first.');
  if (!engine.isInitialized()) {
    // Engine exists but PaddleOCR.create() returned null — reinitialize.
    console.log('[OCR] engine exists but not initialized, reinitializing...');
    await engine.initialize({
      languageMode: 'auto',
      backend: currentBackend ?? 'webgpu',
      wasmPaths: defaultWasmPaths(),
    });
    console.log('[OCR] reinitialize done, initialized:', engine.isInitialized());
  }
  try {
    const results = await engine.recognize(payload.image, { minScore: payload.minScore });
    console.log('[OCR] recognize succeeded, results count:', results.length);
    return { results };
  } catch (e) {
    console.error('[OCR] recognize failed:', e);
    throw e;
  }
}

async function handleOcrDispose(): Promise<{ ok: true }> {
  if (engine) {
    await engine.dispose();
    engine = null;
    currentBackend = null;
  }
  // Do NOT close the offscreen document — ffmpeg may still be running.
  return { ok: true };
}

// The offscreen document has one runtime.onMessage listener in ffmpegRunner.ts.
// It delegates OCR message types to ocrMessageListener so response ownership is
// deterministic when ffmpeg and OCR share the same document.
// Debug: expose the handler for DevTools inspection.
(self as unknown as Record<string, unknown>).__ocrListenerRegistered = true;
(self as unknown as Record<string, unknown>).__ocrListenerFn = ocrMessageListener;
// Debug: log script load + handler registration to chrome.storage.local.
console.log('[OCR] ocrRunner.ts bottom — listener registered');
try { chrome.storage.local.set({ __ocrListenerMsg: 'REGISTERED@' + Date.now(), __ocrScriptLoaded: true }).catch(() => {}); } catch {}
