// signatureGenerator — SHA-256(first 1MB)_size_name (ADR-023 D7, spec F8).
//
// Dedupe key. 1MB sample + size + name = đủ unique (collision cần cùng 1MB
// đầu + cùng size + cùng name). Re-import same file = same signature →
// DuplicateFileError. Uses native crypto.subtle (0 dep).

import { stripExtension } from './fileDetector';

/** Minimal file-like interface for signature computation. */
export interface SignableFile {
  readonly size: number;
  readonly name: string;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

/** Compute signature: `${sha256(first1MB)}_${size}_${nameWithoutExt}`. */
export async function computeSignature(file: SignableFile): Promise<string> {
  const head = await file.slice(0, 1024 * 1024).arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', head);
  const hashHex = bufferToHex(hashBuffer);
  const nameWithoutExt = stripExtension(file.name);
  return `${hashHex}_${file.size}_${nameWithoutExt}`;
}

/** Convert ArrayBuffer to hex string. */
export function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!.toString(16);
    hex.push(b.length < 2 ? '0' + b : b);
  }
  return hex.join('');
}

/** Compute signature from raw head bytes + size + name (test helper). */
export async function computeSignatureFromHead(head: Uint8Array, size: number, name: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', head.buffer as ArrayBuffer);
  const hashHex = bufferToHex(hashBuffer);
  const nameWithoutExt = stripExtension(name);
  return `${hashHex}_${size}_${nameWithoutExt}`;
}
