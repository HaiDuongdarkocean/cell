// PaddleOcrEngine — skeleton (T1). Real implementation in T4.
// Implements OcrEngine interface; throws NOT_IMPLEMENTED until T4 wires PaddleOCR.js.

import type { OcrEngine } from './ocrEngine';
import type { ImageSource, OcrResult, OcrConfig, OcrOptions } from './types';

export class PaddleOcrEngine implements OcrEngine {
  async initialize(_config: OcrConfig): Promise<void> {
    throw new Error('NOT_IMPLEMENTED — wired in T4');
  }
  async recognize(_image: ImageSource, _options?: OcrOptions): Promise<OcrResult[]> {
    throw new Error('NOT_IMPLEMENTED — wired in T4');
  }
  async dispose(): Promise<void> {
    throw new Error('NOT_IMPLEMENTED — wired in T4');
  }
}
