import { espeakStereoToMono, trimAndNormalizePcm } from './espeakPcm';

describe('espeakStereoToMono', () => {
  it('keeps the left channel of duplicated stereo frames', () => {
    const stereo = new Float32Array([0.5, 0.5, -0.25, -0.25, 1, 1]);
    expect([...espeakStereoToMono(stereo)]).toEqual([0.5, -0.25, 1]);
  });

  it('halves the sample count so duration is correct', () => {
    const stereo = new Float32Array(22050 * 2);
    expect(espeakStereoToMono(stereo)).toHaveLength(22050);
  });

  it('returns empty for an empty buffer', () => {
    expect(espeakStereoToMono(new Float32Array(0))).toHaveLength(0);
  });
});

describe('trimAndNormalizePcm', () => {
  it('drops silence beyond the lead margin', () => {
    const sr = 22050;
    const samples = new Float32Array(sr).fill(0);
    samples.fill(0.4, Math.round(sr * 0.3), Math.round(sr * 0.5));
    const out = trimAndNormalizePcm(samples, sr);
    expect(out.length).toBeLessThan(sr * 0.5);
    expect(out.length).toBeGreaterThan(sr * 0.15);
  });

  it('normalizes a quiet clip to the target peak', () => {
    const out = trimAndNormalizePcm(new Float32Array([0.01, 0.05, -0.05]), 22050);
    let peak = 0;
    for (const s of out) peak = Math.max(peak, Math.abs(s));
    expect(peak).toBeCloseTo(0.65, 2);
  });

  it('returns the input untouched when fully silent', () => {
    const silent = new Float32Array(100);
    expect(trimAndNormalizePcm(silent, 22050)).toBe(silent);
  });
});
