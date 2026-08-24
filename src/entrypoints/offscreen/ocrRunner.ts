// ocrRunner — offscreen document script for OCR (spec §AD2, §AD5).
// Runs alongside ffmpegRunner.ts in the same offscreen document (ffmpeg.html).
// Handles OCR_INIT / OCR_RECOGNIZE / OCR_DISPOSE messages from background.
// One engine per engineKey (model name, ADR-082) with LRU eviction.
// OCR_DISPOSE frees engines — does NOT close the offscreen document (ffmpeg may be running).

import { MESSAGE_TYPES } from '@/shared/config/messages';
import { getURL } from '@/shared/lib/chrome-apis';
import { PaddleOcrEngine } from '@/features/ocr/engine/paddleOcrEngine';
import { PADDLE_OCR_LANGUAGE_GROUPS } from '@/features/ocr/engine/paddleOcrLanguages';
import type { PaddleLangAbbr } from '@/features/ocr/engine/paddleOcrLanguages';
import type { OcrEngine } from '@/features/ocr/engine/ocrEngine';
import { OCR_DEFAULT_ENGINE_KEY } from '@/features/ocr/engine/types';
import type { ImageSource, OcrResult, OcrConfig, OcrBackend, OcrLanguageMode } from '@/features/ocr/engine/types';

// Catch CSP errors that try-catch misses — CSP violations fire as window.onerror,
// not as caught exceptions. Without this, EvalError from OpenCV/ORT is silent.
(self as unknown as { onerror: (msg: string, src: string, line: number, col: number, err: Error) => void }).onerror = (msg, src, line, col, err) => {
  console.error('[OFFSCREEN-ONERROR]', { msg, src, line, col, err });
};

/** OCR message payloads. */
interface OcrInitPayload {
  readonly languageMode: OcrConfig['languageMode'];
  readonly backend: OcrBackend;
  /** Model name (ADR-082). Missing → default model (backward compat). */
  readonly engineKey?: string;
}

interface OcrRecognizePayload {
  readonly image: { data: Uint8ClampedArray | number[] | string; width: number; height: number };
  readonly minScore?: number;
  readonly engineKey?: string;
}

interface OcrDisposePayload {
  /** Dispose a single engine; missing → dispose all (legacy behavior). */
  readonly engineKey?: string;
}

interface OcrInitResult {
  readonly status: 'ready' | 'error';
  readonly backend: OcrBackend;
  readonly error?: string;
}

interface OcrRecognizeResult {
  readonly results: OcrResult[];
}

/** Resident OCR engines keyed by engineKey — live in offscreen document (ADR-082). */
interface EngineEntry {
  readonly engine: OcrEngine;
  readonly backend: OcrBackend;
  lastUsed: number;
}
const engines = new Map<string, EngineEntry>();

/** Max resident engines — each WASM model is RAM-heavy (deviceMemory heuristic). */
const DEVICE_MEMORY = typeof navigator === 'undefined'
  ? 8
  : (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
const MAX_RESIDENT = DEVICE_MEMORY >= 4 ? 2 : 1;
let lruClock = 0;

/** model name → representative catalog abbr (auto-init language for a key after LRU eviction). */
const MODEL_DEFAULT_LANG = new Map<string, PaddleLangAbbr>(
  PADDLE_OCR_LANGUAGE_GROUPS.map((g) => [g.model, g.languages[0]!.abbr] as const),
);

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

    case MESSAGE_TYPES.OCR_DISPOSE: {
      const payload = (msg as unknown as { payload?: OcrDisposePayload }).payload ?? {};
      void handleOcrDispose(payload).then(sendResponse).catch((e: unknown) => sendResponse({ error: String(e) }));
      return true;
    }
  }
}

function touchEntry(entry: EngineEntry): EngineEntry {
  entry.lastUsed = ++lruClock;
  return entry;
}

function evictIfNeeded(): void {
  while (engines.size > MAX_RESIDENT) {
    let oldestKey: string | null = null;
    let oldest = Infinity;
    for (const [k, e] of engines) if (e.lastUsed < oldest) { oldest = e.lastUsed; oldestKey = k; }
    if (!oldestKey) break;
    const victim = engines.get(oldestKey);
    engines.delete(oldestKey);
    void victim?.engine.dispose().catch(() => {});
  }
}

async function getOrInitEngine(engineKey: string, languageMode: OcrLanguageMode): Promise<EngineEntry> {
  const existing = engines.get(engineKey);
  if (existing?.engine.isInitialized()) return touchEntry(existing);
  if (existing) {
    // Engine exists but PaddleOCR.create() returned null — drop and reinitialize.
    try { await existing.engine.dispose(); } catch {}
    engines.delete(engineKey);
  }
  evictIfNeeded();
  // Force WASM backend — WebGPU hangs in offscreen documents (no GPU rendering context).
  const effectiveBackend: OcrBackend = 'wasm';
  const engine: OcrEngine = new PaddleOcrEngine();
  const config: OcrConfig = {
    languageMode,
    backend: effectiveBackend,
    wasmPaths: defaultWasmPaths(),
  };
  await engine.initialize(config);
  const fresh: EngineEntry = { engine, backend: effectiveBackend, lastUsed: ++lruClock };
  engines.set(engineKey, fresh);
  return fresh;
}

async function handleOcrInit(payload: OcrInitPayload): Promise<OcrInitResult> {
  try {
    const entry = await getOrInitEngine(payload.engineKey ?? OCR_DEFAULT_ENGINE_KEY, payload.languageMode);
    return { status: 'ready', backend: entry.backend };
  } catch (e) {
    // Backend is always forced to 'wasm' — mirrors the pre-multilingual error shape.
    return { status: 'error', backend: 'wasm', error: String(e) };
  }
}

async function handleOcrRecognize(payload: OcrRecognizePayload): Promise<OcrRecognizeResult> {
  const engineKey = payload.engineKey ?? OCR_DEFAULT_ENGINE_KEY;
  const entry = await getOrInitEngine(engineKey, MODEL_DEFAULT_LANG.get(engineKey) ?? OCR_DEFAULT_ENGINE_KEY);
  const img = payload.image;
  const image: ImageSource = typeof img.data === 'string'
    ? { data: decodeBase64ToUint8Clamped(img.data), width: img.width, height: img.height }
    : img as ImageSource;
  const results = await entry.engine.recognize(image, { minScore: payload.minScore });
  return { results };
}

function decodeBase64ToUint8Clamped(base64: string): Uint8ClampedArray {
  const binary = atob(base64);
  const bytes = new Uint8ClampedArray(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function handleOcrDispose(payload: OcrDisposePayload): Promise<{ ok: true }> {
  if (payload.engineKey) {
    const entry = engines.get(payload.engineKey);
    if (entry) {
      engines.delete(payload.engineKey);
      await entry.engine.dispose();
    }
  } else {
    const entries = [...engines.values()];
    engines.clear();
    for (const e of entries) await e.engine.dispose();
  }
  // Do NOT close the offscreen document — ffmpeg may still be running.
  return { ok: true };
}
