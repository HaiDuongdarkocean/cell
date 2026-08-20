// OcrEngine interface — spec §AD1.
// Abstraction over OCR engines (PaddleOCR primary, Tesseract future fallback).

import type { ImageSource, OcrResult, OcrConfig, OcrOptions } from './types';

/** OCR engine abstraction. Implementations: PaddleOcrEngine (primary). */
export interface OcrEngine {
  /** Load model + initialize backend. Idempotent — safe to call twice. */
  initialize(config: OcrConfig): Promise<void>;
  /** Run OCR on an image. Returns all detected text boxes with confidence. */
  recognize(image: ImageSource, options?: OcrOptions): Promise<OcrResult[]>;
  /** Free model + session + backend resources. Does NOT close the offscreen document. */
  dispose(): Promise<void>;
}
