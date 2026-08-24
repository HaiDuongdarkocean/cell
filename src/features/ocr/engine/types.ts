// OcrEngine types — spec §AD1, §Architecture.
// ImageSource = ImageData shape, transferable via chrome.runtime.sendMessage.
// chrome.runtime.sendMessage uses JSON serialization — typed arrays become {}.
// Callers encode data as base64 string; receivers decode to Uint8ClampedArray.

import type { PaddleLangAbbr } from './paddleOcrLanguages';

export interface ImageSource {
  readonly data: Uint8ClampedArray | number[];
  readonly width: number;
  readonly height: number;
}

/** 4-point quadrilateral polygon [x,y] clockwise from top-left. */
export type Quad = readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]];

/** Single OCR detection result — one text box. */
export interface OcrResultItem {
  /** 4-point bounding polygon in source image coordinates. */
  readonly poly: Quad;
  /** Recognized text (may contain mixed scripts — use scriptRunSegmenter to split). */
  readonly text: string;
  /** Confidence score 0-1. */
  readonly score: number;
}

/** OCR result for one image — all detected text boxes. */
export interface OcrResult {
  readonly image: { readonly width: number; readonly height: number };
  readonly items: readonly OcrResultItem[];
  readonly metrics: { readonly detMs: number; readonly recMs: number; readonly totalMs: number };
}

/** OCR backend selection. */
export type OcrBackend = 'webgpu' | 'wasm';

/** Language mode — 'auto' lets engine detect; others are PaddleOCR catalog abbrs (SSOT: paddleOcrLanguages). */
export type OcrLanguageMode = 'auto' | PaddleLangAbbr;

/** Default engineKey (model name) when a message omits it — the bundled default model.
 *  Backward compatible with pre-multilingual messages. */
export const OCR_DEFAULT_ENGINE_KEY = 'ch';

/** Engine initialization config. */
export interface OcrConfig {
  readonly languageMode: OcrLanguageMode;
  readonly backend: OcrBackend;
  /** Path prefix for bundled .wasm files (MV3: must be extension-internal). */
  readonly wasmPaths: string;
  /** Model URL for lazy-load (CDN OK — .onnx are data, not code). */
  readonly modelUrl?: string;
}

/** Per-recognition options. */
export interface OcrOptions {
  /** Minimum confidence score to include in results (default 0.5). */
  readonly minScore?: number;
  /** Restrict detection to a sub-region of the image. */
  readonly region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}
