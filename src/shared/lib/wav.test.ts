import { describe, expect, it } from '@jest/globals';
import { encodeWav } from './wav';

describe('encodeWav', () => {
  it('produces a valid RIFF/WAVE header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const wav = encodeWav(samples, 22050);

    expect(new TextDecoder().decode(wav.subarray(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wav.subarray(8, 12))).toBe('WAVE');
    expect(new TextDecoder().decode(wav.subarray(12, 16))).toBe('fmt ');
    expect(new TextDecoder().decode(wav.subarray(36, 40))).toBe('data');
  });

  it('encodes PCM16 fields and data size for each sample rate', () => {
    const samples = new Float32Array(2000).map((_, i) => Math.sin(i / 10) * 1.5);
    const rates = [8000, 22050, 44100, 48000];
    for (const rate of rates) {
      const wav = encodeWav(samples, rate);
      const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
      expect(wav.byteLength).toBe(44 + samples.length * 2);
      expect(view.getUint32(4, true)).toBe(36 + samples.length * 2);
      expect(view.getUint16(22, true)).toBe(1);
      expect(view.getUint32(24, true)).toBe(rate);
      expect(view.getUint32(28, true)).toBe(rate * 2);
      expect(view.getUint16(32, true)).toBe(2);
      expect(view.getUint16(34, true)).toBe(16);
      expect(view.getUint32(40, true)).toBe(samples.length * 2);
    }
  });

  it('clamps out-of-range samples', () => {
    const wav = encodeWav(new Float32Array([2, -2]), 22050);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
  });
});
