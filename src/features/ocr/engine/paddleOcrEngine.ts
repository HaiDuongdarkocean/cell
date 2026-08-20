// PaddleOcrEngine — primary OCR engine (spec §AD1, §AD3, §AD7).
// Wraps @paddleocr/paddleocr-js PP-OCRv5 mobile. WebGPU preferred, WASM fallback.
// .wasm files bundled in extension (MV3 cấm remotely-hosted code) — wasmPaths set internally.
// Model weights (.onnx) lazy-load from CDN → IndexedDB cache (data, not code).

import type { OcrEngine } from './ocrEngine';
import type { ImageSource, OcrResult, OcrResultItem, OcrConfig, OcrOptions, OcrBackend, Quad } from './types';

/** PaddleOCR.js module — lazy-loaded only in offscreen document (not content script). */
type PaddleOCRModule = typeof import('@paddleocr/paddleocr-js');
type PaddleOCRInstance = Awaited<ReturnType<PaddleOCRModule['PaddleOCR']['create']>>;
type PaddleOcrResult = Awaited<ReturnType<PaddleOCRInstance['predict']>>;

/** Map OcrLanguageMode → PaddleOCR.js lang param. */
const LANG_MAP: Record<OcrConfig['languageMode'], string> = {
  auto: 'ch',  // PP-OCRv5 'ch' model covers CN+EN+JA (mixed-language).
  zh: 'ch',
  en: 'ch',    // Same model — 'ch' handles English too.
  ja: 'ch',    // Same model — 'ch' handles Japanese kanji+kana.
};

/** Convert PaddleOCR.js result → OcrResult[]. */
function adaptResult(result: PaddleOcrResult, imageWidth: number, imageHeight: number): OcrResult[] {
  // PaddleOCR.js returns OcrResult[] — each has items[] with poly + text + score.
  const results = Array.isArray(result) ? result : [result];
  return results.map((r) => {
    const items: OcrResultItem[] = (r.items ?? []).map((item) => ({
      poly: (item.poly ?? [[0, 0], [0, 0], [0, 0], [0, 0]]) as unknown as Quad,
      text: item.text ?? '',
      score: item.score ?? 0,
    }));
    const metrics = r.metrics ?? { detMs: 0, recMs: 0, totalMs: 0 };
    return {
      image: { width: imageWidth, height: imageHeight },
      items,
      metrics: {
        detMs: metrics.detMs ?? 0,
        recMs: metrics.recMs ?? 0,
        totalMs: metrics.totalMs ?? 0,
      },
    };
  });
}

export class PaddleOcrEngine implements OcrEngine {
  private instance: PaddleOCRInstance | null = null;
  private module: PaddleOCRModule | null = null;
  private currentBackend: OcrBackend | null = null;

  async initialize(config: OcrConfig): Promise<void> {
    if (this.instance) return; // Idempotent.

    // Lazy-load PaddleOCR.js module — only in offscreen document context.
    this.module = await import('@paddleocr/paddleocr-js');
    const { PaddleOCR } = this.module;

    const lang = LANG_MAP[config.languageMode] ?? 'ch';
    this.currentBackend = config.backend;

    this.instance = await PaddleOCR.create({
      lang,
      ocrVersion: 'PP-OCRv5',
      ortOptions: {
        backend: config.backend,
        // MV3: .wasm must be bundled — wasmPaths points to extension-internal path.
        wasmPaths: config.wasmPaths,
        numThreads: 1,  // Single-thread (no SharedArrayBuffer without COOP/COEP).
        simd: true,
      },
    });

    // PaddleOCR.create may auto-initialize; call initialize() if available.
    const maybeInit = this.instance as unknown as { initialize?: () => Promise<unknown> };
    if (typeof maybeInit.initialize === 'function') {
      try {
        await maybeInit.initialize();
      } catch {
        // Already initialized — safe to ignore.
      }
    }

    // T21: WebGPU shader JIT warmup — run dummy recognize() to trigger shader compilation
    // before READY status. Hides the 5s first-run stall from the user.
    if (config.backend === 'webgpu') {
      await this.warmupShaderJit();
    }
  }

  /** T21: Run a dummy OCR on a tiny black image to trigger WebGPU shader JIT. */
  private async warmupShaderJit(): Promise<void> {
    if (!this.instance) return;
    try {
      if (typeof OffscreenCanvas === 'undefined') return;
      const canvas = new OffscreenCanvas(64, 32);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 64, 32);
      await this.instance.predict(canvas);
    } catch {
      // Warmup failure is non-fatal — first real OCR will still work (just slower).
    }
  }

  async recognize(image: ImageSource, options?: OcrOptions): Promise<OcrResult[]> {
    if (!this.instance) throw new Error('PaddleOcrEngine not initialized — call initialize() first.');

    // Convert ImageSource → canvas for PaddleOCR.js predict().
    // PaddleOCR.js accepts HTMLCanvasElement, HTMLImageElement, ImageBitmap, or URL.
    // In a Worker/offscreen document, we use OffscreenCanvas.
    // ponytail: OffscreenCanvas not available in jsdom — real browser only.
    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('OffscreenCanvas unavailable — OCR requires a real browser/offscreen document context.');
    }
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context for OCR canvas.');
    // ponytail: ImageData constructor overload mismatch in TS — use createImageData + copy.
    const imageData = ctx.createImageData(image.width, image.height);
    imageData.data.set(image.data);

    const rawResult = await this.instance.predict(canvas);
    let results = adaptResult(rawResult as PaddleOcrResult, image.width, image.height);

    // Apply minScore filter if specified.
    const minScore = options?.minScore ?? 0;
    if (minScore > 0) {
      results = results.map((r) => ({
        ...r,
        items: r.items.filter((item) => item.score >= minScore),
      }));
    }

    return results;
  }

  async dispose(): Promise<void> {
    // Free ORT session + model. PaddleOCR.js doesn't expose explicit dispose,
    // so we release the instance reference and let GC handle it.
    // WebGPU device is released when the instance is garbage-collected.
    this.instance = null;
    this.module = null;
    this.currentBackend = null;
  }

  /** Current backend in use (for status display). */
  getBackend(): OcrBackend | null {
    return this.currentBackend;
  }
}
