import { describe, expect, it } from '@jest/globals';
import { decodeBase64ToArrayBuffer, encodeBase64 } from './base64';

describe('base64 helpers', () => {
  it('round-trips an ArrayBuffer', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const decoded = new Uint8Array(decodeBase64ToArrayBuffer(encodeBase64(bytes.buffer)));
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it('round-trips a plain Uint8Array', () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    const decoded = new Uint8Array(decodeBase64ToArrayBuffer(encodeBase64(bytes)));
    expect(Array.from(decoded)).toEqual([0x52, 0x49, 0x46, 0x46]);
  });

  it('encodes only the view window of a Uint8Array with non-zero byteOffset', () => {
    const backing = new Uint8Array([9, 9, 1, 2, 3, 8, 8]);
    const view = new Uint8Array(backing.buffer, 2, 3);
    const decoded = new Uint8Array(decodeBase64ToArrayBuffer(encodeBase64(view)));
    expect(Array.from(decoded)).toEqual([1, 2, 3]);
  });

  it('handles buffers larger than one chunk', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256);
    const decoded = new Uint8Array(decodeBase64ToArrayBuffer(encodeBase64(bytes)));
    expect(decoded).toEqual(bytes);
  });
});
