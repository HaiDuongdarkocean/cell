// PaddleOcrEngine — primary OCR engine (spec §AD1, §AD3, §AD7).
// Wraps @paddleocr/paddleocr-js PP-OCRv5 mobile. WebGPU preferred, WASM fallback.
// .wasm files bundled in extension (MV3 cấm remotely-hosted code) — wasmPaths set internally.
// Model weights (.onnx) lazy-load from CDN → IndexedDB cache (data, not code).

import type { OcrEngine } from './ocrEngine';
import type { ImageSource, OcrResult, OcrResultItem, OcrConfig, OcrOptions, OcrBackend, Quad } from './types';
import { OCR_DEFAULT_ENGINE_KEY } from './types';
import { ENGINE_KEY_FOR_LANG } from './paddleOcrLanguages';
import { getURL } from '@/shared/lib/chrome-apis';
// OpenCV is dynamically imported inside initialize() — NOT at top level.
// A static import loads 9.9MB WASM immediately on script load; if it fails
// in the offscreen document, the entire ocrRunner.ts script throws and
// the OCR message listener never registers (OCR_INIT returns undefined).
// Dynamic import defers WASM load to initialize() where errors are caught.

/** PaddleOCR.js module — lazy-loaded only in offscreen document (not content script). */
type PaddleOCRModule = typeof import('@paddleocr/paddleocr-js');
type PaddleOCRInstance = Awaited<ReturnType<PaddleOCRModule['PaddleOCR']['create']>>;
type PaddleOcrResult = Awaited<ReturnType<PaddleOCRInstance['predict']>>;

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

    let step = 'start';

    try {
    step = 'import-paddleocr';
    const mod = await Promise.race([
      import('@paddleocr/paddleocr-js'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PaddleOCR module import timeout (10s)')), 10000),
      ),
    ]) as NonNullable<typeof this.module>;
    this.module = mod;
    const { PaddleOCR } = mod;

    // Dynamic import OpenCV — bypass Vite preload helper with @vite-ignore.
    // Vite's __vite__preloadHelper creates <link> elements that hang in offscreen
    // documents. Direct chrome.runtime.getURL() import skips the preload entirely.
    step = 'import-opencv';
    const cvUrl = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
      ? chrome.runtime.getURL('assets/opencv-Cphpfehb.js')
      : null;
    const cv = cvUrl
      ? (await Promise.race([
          import(/* @vite-ignore */ cvUrl),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('OpenCV module import timeout (15s)')), 15000),
          ),
        ])).default
      : (await import('@techstark/opencv-js')).default;

    // Model resolution (spec ocr-split-dual-stream, ADR-082): ENGINE_KEY_FOR_LANG
    // is SSOT — accepts catalog abbr or ISO; legacy 'zh'/'ja' and unknown values
    // resolve via the catalog; 'auto' → default model (PP-OCRv5 'ch' covers CN+EN+JA).
    const engineKey = ENGINE_KEY_FOR_LANG(config.languageMode === 'auto' ? OCR_DEFAULT_ENGINE_KEY : config.languageMode);
    const isDefaultModel = engineKey === OCR_DEFAULT_ENGINE_KEY;
    const lang = isDefaultModel ? OCR_DEFAULT_ENGINE_KEY : config.languageMode;
    this.currentBackend = config.backend;

    // Pre-initialize OpenCV — wait for Emscripten's then() to resolve
    // (fires after initRuntime() which binds WASM types).
    step = 'cv-preinit';
    const cvPre = cv as unknown as { then?: (cb: (m: unknown) => void) => void; calledRun?: boolean };
    if (cvPre.then) {
      await Promise.race([
        new Promise<void>((resolve) => cvPre.then!(() => resolve())),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('OpenCV pre-init timeout (10s)')), 10000),
        ),
      ]);
    } else if (!cvPre.calledRun) {
      await Promise.race([
        new Promise<void>((resolve) => {
          (cv as unknown as { onRuntimeInitialized: () => void }).onRuntimeInitialized = () => resolve();
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('OpenCV pre-init timeout (10s)')), 10000),
        ),
      ]);
    }

    // Verify embind type binding is complete — PaddleOCR needs cv.Mat constructor.
    // UnboundTypeError occurs when Emscripten types aren't registered yet.
    const cvTest = cv as unknown as { Mat: new (...args: number[]) => unknown; CV_8UC1?: number; imread?: (canvas: HTMLCanvasElement) => unknown };
    for (let i = 0; i < 10; i++) {
      try {
        const testMat = new cvTest.Mat(1, 1, cvTest.CV_8UC1 ?? 0);
        (testMat as { delete?: () => void }).delete?.();
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 10; testCanvas.height = 10;
        if (typeof cvTest.imread !== 'function') throw new Error('OpenCV imread unavailable');
        const testImg = cvTest.imread(testCanvas);
        (testImg as { delete?: () => void }).delete?.();
        break;
      } catch (matErr) {
        if (i === 9) throw new Error('OpenCV Mat creation failed after 10 retries: ' + String(matErr));
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const modelBase = getURL('models/');
    this.instance = await Promise.race([
      PaddleOCR.create({
        lang,
        ocrVersion: 'PP-OCRv5',
        textDetectionModelName: 'PP-OCRv5_mobile_det',
        textDetectionModelAsset: { url: modelBase + 'PP-OCRv5_mobile_det_onnx_infer.tar' },
        textRecognitionModelName: 'PP-OCRv5_mobile_rec',
        // Default model is bundled (MV3-friendly); non-default models omit the
        // asset so paddleocr-js resolves the URL by lang (CDN → IndexedDB, ADR-082).
        ...(isDefaultModel ? { textRecognitionModelAsset: { url: modelBase + 'PP-OCRv5_mobile_rec_onnx_infer.tar' } } : {}),
        ortOptions: {
          backend: config.backend,
          // wasmPaths is a directory prefix — ORT appends filenames to it.
          // patch-ocr-csp.mjs copies .wasm + .mjs to dist/assets/ with expected names.
          wasmPaths: config.wasmPaths,
          numThreads: 1,  // Single-thread (no SharedArrayBuffer without COOP/COEP).
          simd: true,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`PaddleOCR.create() timeout (120s) — backend=${config.backend}`)), 120000),
      ),
    ]) as PaddleOCRInstance | null;

    // PaddleOCR.create may auto-initialize; call initialize() if available.
    const maybeInit = this.instance as unknown as { initialize?: () => Promise<unknown> };
    if (typeof maybeInit.initialize === 'function') {
      try {
        await maybeInit.initialize();
      } catch {
        // Already initialized — safe to ignore.
      }
    }
    } catch (e) {
      throw new Error(`[step=${step}] ${String(e)}`);
    }
  }

  async recognize(image: ImageSource, options?: OcrOptions): Promise<OcrResult[]> {
    if (!this.instance) throw new Error('PaddleOcrEngine not initialized — call initialize() first.');

    // Convert ImageSource → ImageData for PaddleOCR.js predict().
    // PaddleOCR.js accepts HTMLCanvasElement, HTMLImageElement, ImageBitmap, ImageData, or Blob.
    // OffscreenCanvas is NOT accepted (it checks `instanceof HTMLCanvasElement`).
    // ponytail: ImageData constructor overload mismatch in TS — use createImageData + copy.
    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('OffscreenCanvas unavailable — OCR requires a real browser/offscreen document context.');
    }
    const tmpCanvas = new OffscreenCanvas(image.width, image.height);
    const ctx = tmpCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context for OCR canvas.');
    const imageData = ctx.createImageData(image.width, image.height);
    // image.data may arrive as regular Array (JSON-serialized via chrome.runtime.sendMessage)
    // or as Uint8ClampedArray (direct call). Handle both.
    const srcData = image.data as unknown as ArrayLike<number> & Iterable<number>;
    if (srcData instanceof Uint8ClampedArray) {
      imageData.data.set(srcData);
    } else {
      // Regular Array — convert element by element.
      const arr = Array.isArray(srcData) ? srcData : Array.from(srcData);
      for (let i = 0; i < imageData.data.length; i++) {
        imageData.data[i] = arr[i] ?? 0;
      }
    }

    // Retry predict() — OpenCV WASM type binding may not be complete on first call.
    // UnboundTypeError occurs when Emscripten types aren't registered yet.
    // Wait 1s between retries to allow async type binding to complete.
    let rawResult: Awaited<ReturnType<PaddleOCRInstance['predict']>> | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        rawResult = await this.instance.predict(imageData);
        break;
      } catch (err) {
        lastError = err;
        if (attempt < 5 && String(err).includes('UnboundTypeError')) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw err;
      }
    }
    if (rawResult === null) throw lastError;
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

  /** Check if engine is initialized (has a PaddleOCR instance). */
  isInitialized(): boolean {
    return !!this.instance;
  }
}
