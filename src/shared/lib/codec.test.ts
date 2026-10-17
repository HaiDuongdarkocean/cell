import { describe, expect, it } from '@jest/globals';
import { base64UrlToBytes, bytesToHex, hexToBytes } from './codec';

describe('base64UrlToBytes', () => {
  it('decodes base64url alphabet without padding', () => {
    const bytes = base64UrlToBytes('bXZtMQ');
    expect(Array.from(bytes)).toEqual([109, 118, 109, 49]);
  });

  it('maps - and _ back to + and /', () => {
    const bytes = base64UrlToBytes('-_-_');
    const expected = atob('+/+/');
    expect(Array.from(bytes)).toEqual(
      Array.from(expected).map((c) => c.charCodeAt(0)),
    );
  });

  it('handles unpadded input of any length', () => {
    expect(base64UrlToBytes('YQ')).toEqual(new Uint8Array([0x61]));
    expect(base64UrlToBytes('YWI')).toEqual(new Uint8Array([0x61, 0x62]));
    expect(base64UrlToBytes('YWJj')).toEqual(new Uint8Array([0x61, 0x62, 0x63]));
  });
});

describe('hexToBytes', () => {
  it('decodes hex pairs', () => {
    expect(hexToBytes('a8f2')).toEqual(new Uint8Array([0xa8, 0xf2]));
    expect(hexToBytes('')).toEqual(new Uint8Array(0));
  });
});

describe('bytesToHex', () => {
  it('round-trips with hexToBytes', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 160, 255]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
  });

  it('zero-pads each byte', () => {
    expect(bytesToHex(new Uint8Array([0, 9, 255]))).toBe('0009ff');
  });

  it('accepts an ArrayBuffer', () => {
    const buf = new Uint8Array([0xde, 0xad]).buffer;
    expect(bytesToHex(buf)).toBe('dead');
  });
});
