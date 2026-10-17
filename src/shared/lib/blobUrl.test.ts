import { describe, expect, it } from '@jest/globals';
import { createBlobUrl, revokeBlobUrl } from './blobUrl';
import { decodeBase64ToArrayBuffer } from './base64';

describe('createBlobUrl', () => {
  it('creates an object URL when URL.createObjectURL exists', () => {
    const calls: Blob[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: (blob: Blob) => {
        calls.push(blob);
        return 'blob:mock';
      },
    });
    try {
      const url = createBlobUrl(new Uint8Array([1, 2, 3]), 'audio/wav');
      expect(url).toBe('blob:mock');
      expect(calls).toHaveLength(1);
      expect(calls[0].type).toBe('audio/wav');
    } finally {
      delete (URL as { createObjectURL?: unknown }).createObjectURL;
    }
  });

  it('falls back to a data URL producing valid base64 for >64KB input', () => {
    const had = 'createObjectURL' in URL;
    const prev = URL.createObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      const bytes = new Uint8Array(200_000).map((_, i) => i % 256);
      const url = createBlobUrl(bytes, 'audio/wav');
      expect(url.startsWith('data:audio/wav;base64,')).toBe(true);
      const decoded = new Uint8Array(decodeBase64ToArrayBuffer(url.slice(url.indexOf(',') + 1)));
      expect(decoded).toEqual(bytes);
    } finally {
      if (had) {
        Object.defineProperty(URL, 'createObjectURL', {
          configurable: true,
          writable: true,
          value: prev,
        });
      } else {
        delete (URL as { createObjectURL?: unknown }).createObjectURL;
      }
    }
  });
});

describe('revokeBlobUrl', () => {
  it('revokes object URLs without throwing', () => {
    const calls: string[] = [];
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: (url: string) => {
        calls.push(url);
      },
    });
    try {
      revokeBlobUrl('blob:mock');
      expect(calls).toEqual(['blob:mock']);
    } finally {
      delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
    }
  });

  it('does not throw on data: URLs or when API is missing', () => {
    expect(() => revokeBlobUrl('data:audio/wav;base64,AAAA')).not.toThrow();
  });
});
