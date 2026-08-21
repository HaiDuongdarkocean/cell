// PaddleOcrEngine — primary OCR engine (spec §AD1, §AD3, §AD7).
// Wraps @paddleocr/paddleocr-js PP-OCRv5 mobile. WebGPU preferred, WASM fallback.
// .wasm files bundled in extension (MV3 cấm remotely-hosted code) — wasmPaths set internally.
// Model weights (.onnx) lazy-load from CDN → IndexedDB cache (data, not code).

import type { OcrEngine } from './ocrEngine';
import type { ImageSource, OcrResult, OcrResultItem, OcrConfig, OcrOptions, OcrBackend, Quad } from './types';
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

    const dbg = (msg: string) => { console.log('[OCR-ENGINE]', msg); try { chrome.runtime.sendMessage({ type: 'OFFSCREEN_DEBUG_LOG', data: { kind: 'engine', msg, step, time: Date.now() } }).catch(() => {}); } catch {} };
    let step = 'start';

    try {
    // Lazy-load PaddleOCR.js module — only in offscreen document context.
    dbg('before-module-import');
    step = 'import-paddleocr';
    console.log('[PaddleOcrEngine] loading module...');
    const mod = await Promise.race([
      import('@paddleocr/paddleocr-js'),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PaddleOCR module import timeout (10s)')), 10000),
      ),
    ]) as NonNullable<typeof this.module>;
    this.module = mod;
    dbg('after-module-import');
    console.log('[PaddleOcrEngine] module loaded, PaddleOCR:', typeof mod.PaddleOCR);
    const { PaddleOCR } = mod;

    // Dynamic import OpenCV — defers 9.9MB WASM load to here (not script load).
    // If WASM fails, the error is caught by handleOcrInit's try-catch in ocrRunner.
    // 15s timeout: the module itself is ~10MB (embedded WASM as base64 data URI);
    // parsing + evaluation should complete in 2-5s. If it hangs (CSP EvalError
    // during module evaluation that doesn't throw), the timeout fires and
    // returns an error instead of hanging sendMessage forever.
    dbg('before-cv-import');
    step = 'import-opencv';
    // Debug: check if main thread is alive after module import
    setTimeout(() => dbg('cv-import-timeout-0ms'), 0);
    // Bypass Vite preload helper with @vite-ignore + full chrome-extension URL
    // Vite's preload helper creates <link> elements that may block in offscreen documents
    const cvUrl = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
      ? chrome.runtime.getURL('assets/opencv-Cphpfehb.js')
      : null;
    dbg('cv-import-url:' + cvUrl);
    const cv = cvUrl
      ? (await Promise.race([
          import(/* @vite-ignore */ cvUrl).then(m => {
            dbg('cv-import-resolved:hasDefault=' + typeof m.default);
            return m;
          }).catch(e => {
            dbg('cv-import-rejected:' + String(e).slice(0, 200));
            throw e;
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => { dbg('cv-import-timeout-15s'); reject(new Error('OpenCV module import timeout (15s)')); }, 15000),
          ),
        ])).default
      : (await import('@techstark/opencv-js')).default;
    dbg('after-cv-import:hasMat=' + typeof cv?.Mat);

    const lang = LANG_MAP[config.languageMode] ?? 'ch';
    this.currentBackend = config.backend;

    dbg('before-create');
    step = 'cv-preinit';
    console.log('[PaddleOcrEngine] calling PaddleOCR.create()...', { lang, backend: config.backend, wasmPaths: config.wasmPaths });

    // Pre-initialize OpenCV — wait for Emscripten's then() to resolve
    // (fires after initRuntime() which binds WASM types).
    const cvPre = cv as unknown as { then?: (cb: (m: unknown) => void) => void; calledRun?: boolean };
    if (cvPre.then) {
      dbg('cv-preinit-await');
      await Promise.race([
        new Promise<void>((resolve) => cvPre.then!(() => resolve())),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('OpenCV pre-init timeout (10s)')), 10000),
        ),
      ]);
      dbg('cv-preinit-done');
    } else if (!cvPre.calledRun) {
      dbg('cv-preinit-wait-callback');
      await Promise.race([
        new Promise<void>((resolve) => {
          (cv as unknown as { onRuntimeInitialized: () => void }).onRuntimeInitialized = () => resolve();
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('OpenCV pre-init timeout (10s)')), 10000),
        ),
      ]);
      dbg('cv-preinit-done');
    } else {
      dbg('cv-already-ready');
    }

    // Debug: inspect cv state after pre-init.
    const cvAfter = cv as unknown as { Mat?: unknown; calledRun?: boolean; then?: unknown; onRuntimeInitialized?: unknown };
    dbg('cv-after-preinit: hasMat=' + typeof cvAfter.Mat + ' calledRun=' + cvAfter.calledRun + ' hasThen=' + typeof cvAfter.then + ' hasOnRuntime=' + typeof cvAfter.onRuntimeInitialized);

    // Test: try creating a cv.Mat(rows, cols, type) — the constructor with args that PaddleOCR uses.
    // This verifies embind type binding is complete (specifically the `int` type).
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
        dbg('cv-mat-test-ok: attempt=' + (i + 1));
        break;
      } catch (matErr) {
        const errStr = String(matErr);
        dbg('cv-mat-test-fail: attempt=' + (i + 1) + ' err=' + errStr.slice(0, 100));
        if (i === 9) throw new Error('OpenCV Mat creation failed after 10 retries: ' + errStr);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    // Use locally-bundled model files to avoid CDN download delay.
    // Models are .tar archives in public/models/ → copied to dist/models/ by Vite.
    const modelBase = getURL('models/');
    // Non-worker mode: OpenCV + ORT run on the main thread of the offscreen document.
    // Worker mode is impossible because MV3 CSP blocks Function() inside Workers
    // (OpenCV/Emscripten requires Function() for runtime wrappers).
    // On the main thread, Function() IS allowed (confirmed via CSP test).
    const createPromise = PaddleOCR.create({
      lang,
      ocrVersion: 'PP-OCRv5',
      textDetectionModelName: 'PP-OCRv5_mobile_det',
      textDetectionModelAsset: { url: modelBase + 'PP-OCRv5_mobile_det_onnx_infer.tar' },
      textRecognitionModelName: 'PP-OCRv5_mobile_rec',
      textRecognitionModelAsset: { url: modelBase + 'PP-OCRv5_mobile_rec_onnx_infer.tar' },
      ortOptions: {
        backend: config.backend,
        // MV3: .wasm and .mjs must be bundled. wasmPaths is a directory prefix
        // that ORT appends filenames to (e.g. prefix + "ort-wasm-simd-threaded.jsep.wasm").
        // patch-ocr-csp.mjs copies the hashed .wasm to the unhashed name AND
        // copies the .mjs from node_modules to dist/assets/.
        wasmPaths: config.wasmPaths,
        numThreads: 1,  // Single-thread (no SharedArrayBuffer without COOP/COEP).
        simd: true,
      },
    });
    this.instance = await Promise.race([
      createPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`PaddleOCR.create() timeout (120s) — backend=${config.backend}, model download from Baidu CDN may be slow`)), 120000),
      ),
    ]) as PaddleOCRInstance | null;
    dbg('after-create');
    console.log('[PaddleOcrEngine] PaddleOCR.create() returned:', typeof this.instance, !!this.instance);

    // PaddleOCR.create may auto-initialize; call initialize() if available.
    const maybeInit = this.instance as unknown as { initialize?: () => Promise<unknown> };
    if (typeof maybeInit.initialize === 'function') {
      try {
        await maybeInit.initialize();
      } catch {
        // Already initialized — safe to ignore.
      }
    }

    // T21: WebGPU shader JIT warmup — skipped during init to avoid extra delay.
    // Shader JIT happens lazily on first real recognize() call instead.
    // if (config.backend === 'webgpu') {
    //   await this.warmupShaderJit();
    // }
    } catch (e) {
      console.error('[OCR-ENGINE] FAILED at step:', step, 'error:', e);
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
