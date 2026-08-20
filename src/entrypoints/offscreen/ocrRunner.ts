// ocrRunner — offscreen document script for OCR (spec §AD2, §AD5).
// Runs alongside ffmpegRunner.ts in the same offscreen document (ffmpeg.html).
// Handles OCR_INIT / OCR_RECOGNIZE / OCR_DISPOSE messages from background.
// OCR_DISPOSE frees the engine — does NOT close the offscreen document (ffmpeg may be running).

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { onMessage, getURL } from '@/shared/lib/chrome-apis';
import { PaddleOcrEngine } from '@/features/ocr/engine/paddleOcrEngine';
import type { OcrEngine } from '@/features/ocr/engine/ocrEngine';
import type { ImageSource, OcrResult, OcrConfig, OcrBackend } from '@/features/ocr/engine/types';

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

/** Default wasmPaths — bundled in extension dist/wasm/. */
function defaultWasmPaths(): string {
  return getURL('dist/wasm/');
}

/** Message listener for OCR messages. */
function ocrMessageListener(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | undefined {
  const msg = message as { type?: string };
  if (!msg.type) return;

  switch (msg.type) {
    case MESSAGE_TYPES.OCR_INIT:
      void handleOcrInit(msg as unknown as { type: string } & OcrInitPayload)
        .then(sendResponse)
        .catch((e: unknown) => sendResponse({ status: 'error', backend: 'wasm', error: String(e) }));
      return true; // async response

    case MESSAGE_TYPES.OCR_RECOGNIZE:
      void handleOcrRecognize(msg as unknown as { type: string } & OcrRecognizePayload)
        .then(sendResponse)
        .catch((e: unknown) => sendResponse({ error: String(e) }));
      return true;

    case MESSAGE_TYPES.OCR_DISPOSE:
      void handleOcrDispose().then(sendResponse).catch((e: unknown) => sendResponse({ error: String(e) }));
      return true;
  }
}

async function handleOcrInit(payload: OcrInitPayload): Promise<OcrInitResult> {
  if (engine) {
    return { status: 'ready', backend: currentBackend ?? payload.backend };
  }
  engine = new PaddleOcrEngine();
  const config: OcrConfig = {
    languageMode: payload.languageMode,
    backend: payload.backend,
    wasmPaths: defaultWasmPaths(),
  };
  try {
    await engine.initialize(config);
    currentBackend = payload.backend;
    return { status: 'ready', backend: currentBackend };
  } catch (e) {
    // Fallback: try WASM if WebGPU failed.
    if (payload.backend === 'webgpu') {
      try {
        engine = new PaddleOcrEngine();
        await engine.initialize({ ...config, backend: 'wasm' });
        currentBackend = 'wasm';
        return { status: 'ready', backend: 'wasm' };
      } catch (e2) {
        engine = null;
        return { status: 'error', backend: 'wasm', error: String(e2) };
      }
    }
    engine = null;
    return { status: 'error', backend: payload.backend, error: String(e) };
  }
}

async function handleOcrRecognize(payload: OcrRecognizePayload): Promise<OcrRecognizeResult> {
  if (!engine) throw new Error('OCR engine not initialized — send OCR_INIT first.');
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

// Register listener on script load.
onMessage(ocrMessageListener);

// Respond to OFFSCREEN_PING (shared with ffmpegRunner — both listeners see it).
// This ensures the offscreen document is ready for OCR messages too.
