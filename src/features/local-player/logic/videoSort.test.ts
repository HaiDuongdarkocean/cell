import { sortVideosByNumericSuffix } from './videoSort';

describe('sortVideosByNumericSuffix', () => {
  it('sorts by trailing numeric suffix ascending', () => {
    expect(sortVideosByNumericSuffix(['Movie.3.mp4', 'Movie.1.mp4', 'Movie.2.mp4']))
      .toEqual(['Movie.1.mp4', 'Movie.2.mp4', 'Movie.3.mp4']);
  });

  it('falls back to alphabetical when no numeric suffix', () => {
    expect(sortVideosByNumericSuffix(['Beta.mp4', 'Alpha.mp4']))
      .toEqual(['Alpha.mp4', 'Beta.mp4']);
  });

  it('numeric-suffixed files sort before alphabetical ones', () => {
    expect(sortVideosByNumericSuffix(['Zebra.mp4', 'Movie.1.mp4', 'Alpha.mp4']))
      .toEqual(['Movie.1.mp4', 'Alpha.mp4', 'Zebra.mp4']);
  });

  it('handles episode numbers (S01E02, S01E10, S01E01)', () => {
    expect(sortVideosByNumericSuffix(['S01E02.mp4', 'S01E10.mp4', 'S01E01.mp4']))
      .toEqual(['S01E01.mp4', 'S01E02.mp4', 'S01E10.mp4']);
  });

  it('preserves order for empty input', () => {
    expect(sortVideosByNumericSuffix([])).toEqual([]);
  });

  it('handles single file', () => {
    expect(sortVideosByNumericSuffix(['Solo.mp4'])).toEqual(['Solo.mp4']);
  });

  it('handles multi-digit numbers (10, 100, 2)', () => {
    expect(sortVideosByNumericSuffix(['Ep.100.mp4', 'Ep.2.mp4', 'Ep.10.mp4']))
      .toEqual(['Ep.2.mp4', 'Ep.10.mp4', 'Ep.100.mp4']);
  });

  it('does not mutate input array', () => {
    const input = ['Movie.3.mp4', 'Movie.1.mp4'];
    sortVideosByNumericSuffix(input);
    expect(input).toEqual(['Movie.3.mp4', 'Movie.1.mp4']);
  });
});
