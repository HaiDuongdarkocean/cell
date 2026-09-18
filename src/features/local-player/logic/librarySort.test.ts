import { sortLibrary, type VideoEntry, type SortBy } from './librarySort';

import scenarios from '../../../../tests/data-test/local-player/samples/library-metadata/sort-scenarios.json';
import videoEntries from '../../../../tests/data-test/local-player/samples/library-metadata/video-entries.json';

type Scenario = {
  scenario: string;
  input: VideoEntry[];
  sortBy: SortBy;
  expected: string[];
};

const typedScenarios = scenarios as Scenario[];
const typedVideoEntries = videoEntries as VideoEntry[];

describe('librarySort — sort-scenarios.json (12 scenarios)', () => {
  it.each(typedScenarios.map((s) => [s.scenario, s] as const))(
    '%s',
    (_name, s) => {
      const result = sortLibrary(s.input, s.sortBy);
      expect(result.map((v) => v.id)).toEqual(s.expected);
    },
  );
});

describe('librarySort — video-entries.json (26 real entries)', () => {
  it('sort by recent → recently watched first, unwatched at end', () => {
    const result = sortLibrary(typedVideoEntries, 'recent');
    const ids = result.map((v) => v.id);

    // Watched (lastWatchedAt non-null) must come before all unwatched.
    const firstUnwatchedIdx = ids.findIndex(
      (id) => typedVideoEntries.find((v) => v.id === id)!.lastWatchedAt === null,
    );
    const lastWatchedIdx = ids.reduce(
      (acc, id, idx) =>
        typedVideoEntries.find((v) => v.id === id)!.lastWatchedAt !== null ? idx : acc,
      -1,
    );
    expect(firstUnwatchedIdx).toBeGreaterThan(lastWatchedIdx);

    // Among watched, lastWatchedAt must be descending.
    const watched = result.filter((v) => v.lastWatchedAt !== null);
    for (let i = 1; i < watched.length; i += 1) {
      expect(watched[i - 1].lastWatchedAt! >= watched[i].lastWatchedAt!).toBe(true);
    }
  });

  it('sort by title → case-insensitive alpha (natural number + code-point aware)', () => {
    const result = sortLibrary(typedVideoEntries, 'title');
    const titles = result.map((v) => v.title);
    // Independent oracle: case-insensitive natural code-point compare.
    const isDigit = (ch: string) => ch >= '0' && ch <= '9';
    const naturalCmp = (a: string, b: string): number => {
      let i = 0;
      let j = 0;
      while (i < a.length && j < b.length) {
        const ca = a[i];
        const cb = b[j];
        const ad = isDigit(ca);
        const bd = isDigit(cb);
        if (ad && bd) {
          let ae = i;
          while (ae < a.length && isDigit(a[ae])) ae += 1;
          let be = j;
          while (be < b.length && isDigit(b[be])) be += 1;
          const an = Number(a.slice(i, ae));
          const bn = Number(b.slice(j, be));
          if (an !== bn) return an < bn ? -1 : 1;
          i = ae;
          j = be;
          continue;
        }
        if (ad !== bd) return ad ? -1 : 1;
        const al = ca.toLowerCase();
        const bl = cb.toLowerCase();
        if (al !== bl) return al < bl ? -1 : 1;
        i += 1;
        j += 1;
      }
      return a.length - i - (b.length - j);
    };
    for (let i = 1; i < titles.length; i += 1) {
      expect(naturalCmp(titles[i - 1], titles[i])).toBeLessThanOrEqual(0);
    }
  });

  it('sort by added → newest first', () => {
    const result = sortLibrary(typedVideoEntries, 'added');
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i - 1].addedAt >= result[i].addedAt).toBe(true);
    }
  });

  it('does not mutate the input array', () => {
    const input = [...typedVideoEntries];
    const snapshot = typedVideoEntries.map((v) => ({ ...v }));
    sortLibrary(typedVideoEntries, 'recent');
    expect(typedVideoEntries).toEqual(snapshot);
    expect(input).toEqual(snapshot);
  });
});

describe('librarySort — fit (i+1 queue)', () => {
  const entry = (
    id: string,
    coverage?: number,
    overrides: Partial<VideoEntry> = {},
  ): VideoEntry => ({
    id,
    title: id,
    addedAt: '2026-01-01T00:00:00.000Z',
    lastWatchedAt: null,
    durationMs: 0,
    resumePositionMs: 0,
    ...(coverage === undefined ? {} : { comprehension: { coverage } }),
    ...overrides,
  });

  it('orders scored videos by distance to the 95% sweet spot', () => {
    const result = sortLibrary(
      [entry('far', 70), entry('spot', 94.8), entry('mid', 88), entry('over', 99.9)],
      'fit',
    );
    expect(result.map((v) => v.id)).toEqual(['spot', 'over', 'mid', 'far']);
  });

  it('unscored videos sort last, among themselves by recent', () => {
    const result = sortLibrary(
      [
        entry('plain-old', undefined, { addedAt: '2026-01-01T00:00:00.000Z' }),
        entry('scored', 90),
        entry('plain-new', undefined, { addedAt: '2026-02-01T00:00:00.000Z' }),
      ],
      'fit',
    );
    expect(result.map((v) => v.id)).toEqual(['scored', 'plain-new', 'plain-old']);
  });

  it('equal distance prefers the lower coverage (deeper i+1)', () => {
    const result = sortLibrary([entry('easy', 97), entry('stretch', 93)], 'fit');
    expect(result.map((v) => v.id)).toEqual(['stretch', 'easy']);
  });

  it('exact target coverage sorts before everything scored', () => {
    const result = sortLibrary(
      [entry('a', 94.9), entry('bullseye', 95), entry('b', 95.1)],
      'fit',
    );
    expect(result[0].id).toBe('bullseye');
  });

  it('falls back to recent when all unscored', () => {
    const result = sortLibrary(
      [
        entry('old', undefined, { addedAt: '2026-01-01T00:00:00.000Z' }),
        entry('new', undefined, { addedAt: '2026-02-01T00:00:00.000Z' }),
      ],
      'fit',
    );
    expect(result.map((v) => v.id)).toEqual(['new', 'old']);
  });
});
