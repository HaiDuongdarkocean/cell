import { buildCondenseFilter, normalizeCueRanges, rangesTotalMs, chunkRanges, displayableCueRanges } from './cueRanges';

describe('displayableCueRanges', () => {
  it('maps cues to ranges and drops cues cleaned to empty text', () => {
    const out = displayableCueRanges([
      { start: 2000, end: 20000, text: '' },
      { start: 20200, end: 25500, text: "LYIN' ISN'T BETTER" },
      { start: 30000, end: 31000, text: '   ' },
      { start: 32000, end: 33000, text: 'dialogue' },
    ]);
    expect(out).toEqual([
      { startMs: 20200, endMs: 25500 },
      { startMs: 32000, endMs: 33000 },
    ]);
  });
});

describe('normalizeCueRanges', () => {
  it('returns empty for no/invalid ranges', () => {
    expect(normalizeCueRanges([], 500, 60000)).toEqual([]);
    expect(normalizeCueRanges([{ startMs: 100, endMs: 100 }], 500, 60000)).toEqual([]);
    expect(normalizeCueRanges([{ startMs: 200, endMs: 100 }], 500, 60000)).toEqual([]);
  });

  it('applies padding and clamps to [0, duration]', () => {
    const out = normalizeCueRanges([{ startMs: 300, endMs: 900 }], 200, 60000);
    expect(out).toEqual([{ startMs: 100, endMs: 1100 }]);
    const clamped = normalizeCueRanges(
      [
        { startMs: 100, endMs: 200 },
        { startMs: 59800, endMs: 59900 },
      ],
      500,
      60000,
    );
    expect(clamped[0]).toEqual({ startMs: 0, endMs: 700 });
    expect(clamped[1]).toEqual({ startMs: 59300, endMs: 60000 });
  });

  it('merges overlapping and adjacent ranges after padding', () => {
    const out = normalizeCueRanges(
      [
        { startMs: 5000, endMs: 6000 },
        { startMs: 1000, endMs: 2000 },
        { startMs: 6100, endMs: 6200 },
      ],
      100,
      60000,
    );
    expect(out).toEqual([
      { startMs: 900, endMs: 2100 },
      { startMs: 4900, endMs: 6300 },
    ]);
  });

  it('merges padded ranges that now touch', () => {
    const out = normalizeCueRanges(
      [
        { startMs: 1000, endMs: 2000 },
        { startMs: 2100, endMs: 3000 },
      ],
      100,
      60000,
    );
    expect(out).toEqual([{ startMs: 900, endMs: 3100 }]);
  });
});

describe('rangesTotalMs', () => {
  it('sums durations', () => {
    expect(rangesTotalMs([{ startMs: 0, endMs: 1000 }, { startMs: 2000, endMs: 4000 }])).toBe(3000);
  });
});

describe('buildCondenseFilter', () => {
  it('builds atrim+concat graph', () => {
    const filter = buildCondenseFilter([
      { startMs: 0, endMs: 1500 },
      { startMs: 3000, endMs: 4500 },
    ]);
    expect(filter).toBe(
      '[0:a]atrim=start=0.000:end=1.500,asetpts=PTS-STARTPTS[a0];' +
        '[0:a]atrim=start=3.000:end=4.500,asetpts=PTS-STARTPTS[a1];' +
        '[a0][a1]concat=n=2:v=0:a=1[out]',
    );
  });
});

describe('chunkRanges', () => {
  it('splits at the max size', () => {
    const ranges = Array.from({ length: 5 }, (_, i) => ({ startMs: i * 1000, endMs: i * 1000 + 500 }));
    const chunks = chunkRanges(ranges, 2);
    expect(chunks.map((c) => c.length)).toEqual([2, 2, 1]);
  });
});
