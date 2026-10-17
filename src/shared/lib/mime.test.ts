import { describe, expect, it } from '@jest/globals';
import { extToMime, mimeToExt } from './mime';

describe('extToMime', () => {
  it('covers every extension the copies covered', () => {
    const expected: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      opus: 'audio/opus',
      webm: 'audio/webm',
      flac: 'audio/flac',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      avif: 'image/avif',
      bmp: 'image/bmp',
    };
    for (const [ext, mime] of Object.entries(expected)) {
      expect(extToMime(ext)).toBe(mime);
    }
  });

  it('is case-insensitive', () => {
    expect(extToMime('MP3')).toBe('audio/mpeg');
  });

  it('falls back to application/octet-stream', () => {
    expect(extToMime('xyz')).toBe('application/octet-stream');
    expect(extToMime('')).toBe('application/octet-stream');
  });
});

describe('mimeToExt', () => {
  it('maps the MIME_TO_EXT table', () => {
    expect(mimeToExt('image/png')).toBe('png');
    expect(mimeToExt('image/jpeg')).toBe('jpg');
    expect(mimeToExt('image/jpg')).toBe('jpg');
    expect(mimeToExt('audio/mpeg')).toBe('mp3');
    expect(mimeToExt('audio/x-wav')).toBe('wav');
    expect(mimeToExt('audio/mp4')).toBe('m4a');
  });

  it('returns undefined for unknown types', () => {
    expect(mimeToExt('text/plain')).toBeUndefined();
  });
});
