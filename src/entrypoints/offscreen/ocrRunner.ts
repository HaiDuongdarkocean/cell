// ocrRunner — offscreen document script for OCR (spec §AD2, §AD5).
// Runs alongside ffmpegRunner.ts in the same offscreen document (ffmpeg.html).
// Handles OCR_INIT / OCR_RECOGNIZE / OCR_DISPOSE messages from background.
// OCR_DISPOSE frees the engine — does NOT close the offscreen document (ffmpeg may be running).

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { getURL } from '@/shared/lib/chrome-apis';
import { PaddleOcrEngine } from '@/features/ocr/engine/paddleOcrEngine';
import type { OcrEngine } from '@/features/ocr/engine/ocrEngine';
import type { ImageSource, OcrResult, OcrConfig, OcrBackend } from '@/features/ocr/engine/types';

// Catch CSP errors that try-catch misses — CSP violations fire as window.onerror,
// not as caught exceptions. Without this, EvalError from OpenCV/ORT is silent.
(self as unknown as { onerror: (msg: string, src: string, line: number, col: number, err: Error) => void }).onerror = (msg, src, line, col, err) => {
  console.error('[OFFSCREEN-ONERROR]', { msg, src, line, col, err });
};

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
 *  to chrome-extension://<id>/assets/ where Vite outputs .wasm files. */
function defaultWasmPaths(): string {
  return getURL('assets/');
}

/** Message listener for OCR messages. */
export function ocrMessageListener(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | undefined {
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

async function handleOcrInit(payload: OcrInitPayload): Promise<OcrInitResult> {
  if (engine?.isInitialized()) {
    return { status: 'ready', backend: currentBackend ?? payload.backend };
  }
  if (engine) {
    try { await engine.dispose(); } catch {}
    engine = null;
  }
  // Force WASM backend — WebGPU hangs in offscreen documents (no GPU rendering context).
  const effectiveBackend: OcrBackend = 'wasm';
  engine = new PaddleOcrEngine();
  const config: OcrConfig = {
    languageMode: payload.languageMode,
    backend: effectiveBackend,
    wasmPaths: defaultWasmPaths(),
  };
  try {
    await engine.initialize(config);
    currentBackend = effectiveBackend;
    return { status: 'ready', backend: currentBackend };
  } catch (e) {
    engine = null;
    return { status: 'error', backend: effectiveBackend, error: String(e) };
  }
}

async function handleOcrRecognize(payload: OcrRecognizePayload): Promise<OcrRecognizeResult> {
  if (!engine) throw new Error('OCR engine not initialized — send OCR_INIT first.');
  if (!engine.isInitialized()) {
    // Engine exists but PaddleOCR.create() returned null — reinitialize.
    await engine.initialize({
      languageMode: 'auto',
      backend: currentBackend ?? 'wasm',
      wasmPaths: defaultWasmPaths(),
    });
  }
  const results = await engine.recognize(payload.image, { minScore: payload.minScore });
  return { results };
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
