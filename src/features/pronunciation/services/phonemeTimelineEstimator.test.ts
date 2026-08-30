import { estimateTimeline } from './phonemeTimelineEstimator';
import { parseIPA } from './ipaSegmenter';

describe('estimateTimeline', () => {
  it('spreads duration uniformly across non-stress phonemes', () => {
    const phonemes = parseIPA('həlˈəʊ');
    const withTime = estimateTimeline(phonemes, 800);

    // h, ə, l, ˈ, əʊ -> 4 sound phonemes, each 200ms
    expect(withTime[0]).toMatchObject({ ipa: 'h', startMs: 0, endMs: 200 });
    expect(withTime[1]).toMatchObject({ ipa: 'ə', startMs: 200, endMs: 400 });
    expect(withTime[2]).toMatchObject({ ipa: 'l', startMs: 400, endMs: 600 });
    expect(withTime[3]).toMatchObject({ ipa: 'ˈ', startMs: 600, endMs: 600 });
    expect(withTime[4]).toMatchObject({ ipa: 'əʊ', startMs: 600, endMs: 800 });
  });

  it('ends exactly at audio duration', () => {
    const phonemes = parseIPA('bˈəʊt');
    const withTime = estimateTimeline(phonemes, 1000);
    expect(withTime[withTime.length - 1].endMs).toBe(1000);
  });

  it('gives stress and separator zero duration', () => {
    const phonemes = parseIPA('ðə kwˈɪk');
    const withTime = estimateTimeline(phonemes, 400);

    const stress = withTime.find((p) => p.ipa === 'ˈ');
    const space = withTime.find((p) => p.ipa === ' ');
    expect(stress).toMatchObject({ startMs: expect.any(Number), endMs: stress?.startMs });
    expect(space).toMatchObject({ startMs: expect.any(Number), endMs: space?.startMs });
  });

  it('throws on negative duration', () => {
    const phonemes = parseIPA('həloʊ');
    expect(() => estimateTimeline(phonemes, -1)).toThrow(RangeError);
  });
});
