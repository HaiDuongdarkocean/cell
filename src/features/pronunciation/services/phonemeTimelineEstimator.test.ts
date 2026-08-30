import { estimateTimeline } from './phonemeTimelineEstimator';
import { parseIPA } from './ipaSegmenter';

describe('estimateTimeline', () => {
  it('distributes duration by phoneme type weight', () => {
    const phonemes = parseIPA('həlˈəʊ');
    const withTime = estimateTimeline(phonemes, 1000);

    // h (consonant, w=1), ə (vowel, w=2), l (consonant, w=1), ˈ (stress, w=0), əʊ (diphthong, w=2.5)
    // total weight = 6.5
    expect(withTime[0]).toMatchObject({ ipa: 'h', startMs: 0 });
    expect(withTime[0].endMs).toBeCloseTo((1 / 6.5) * 1000, 0);
    expect(withTime[1]).toMatchObject({ ipa: 'ə' });
    expect(withTime[1].endMs - withTime[1].startMs).toBeCloseTo((2 / 6.5) * 1000, 0);
    expect(withTime[2]).toMatchObject({ ipa: 'l' });
    expect(withTime[2].endMs - withTime[2].startMs).toBeCloseTo((1 / 6.5) * 1000, 0);
    expect(withTime[3]).toMatchObject({ ipa: 'ˈ' });
    expect(withTime[3].startMs).toBe(withTime[3].endMs);
    expect(withTime[4]).toMatchObject({ ipa: 'əʊ' });
    expect(withTime[4].endMs - withTime[4].startMs).toBeCloseTo((2.5 / 6.5) * 1000, 0);
  });

  it('ends exactly at audio duration', () => {
    const phonemes = parseIPA('bˈəʊt');
    const withTime = estimateTimeline(phonemes, 1000);
    expect(withTime[withTime.length - 1].endMs).toBeCloseTo(1000, 0);
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
