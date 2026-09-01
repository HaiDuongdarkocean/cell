import { encodeSamplesToWav } from './wavEncoder';

describe('encodeSamplesToWav', () => {
  it('produces a valid RIFF/WAVE header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const wav = encodeSamplesToWav(samples, 22050);

    const riff = new TextDecoder().decode(wav.subarray(0, 4));
    const wave = new TextDecoder().decode(wav.subarray(8, 12));
    const fmt = new TextDecoder().decode(wav.subarray(12, 16));
    const data = new TextDecoder().decode(wav.subarray(36, 40));

    expect(riff).toBe('RIFF');
    expect(wave).toBe('WAVE');
    expect(fmt).toBe('fmt ');
    expect(data).toBe('data');
  });

  it('encodes sample rate and data size correctly', () => {
    const samples = new Float32Array(1000);
    const wav = encodeSamplesToWav(samples, 22050);

    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint32(24, true)).toBe(22050); // sample rate
    expect(view.getUint16(22, true)).toBe(1); // num channels
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(view.getUint32(40, true)).toBe(samples.length * 2); // data chunk size
    expect(wav.length).toBe(44 + samples.length * 2);
  });

  it('clamps out-of-range samples', () => {
    const samples = new Float32Array([2, -2, 0.5, -0.5]);
    const wav = encodeSamplesToWav(samples, 22050);
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);

    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(Math.round(0.5 * 32767));
    expect(view.getInt16(50, true)).toBe(Math.round(-0.5 * 32768));
  });
});
