import { isMediaRelevantUrlChange } from '@/entrypoints/background/helpers';

const WATCH = 'https://www.youtube.com/watch?v=RoBabfioVF8';

describe('isMediaRelevantUrlChange', () => {
  it('clears when no previous URL is known', () => {
    expect(isMediaRelevantUrlChange(undefined, WATCH)).toBe(true);
  });

  it('skips identical URLs', () => {
    expect(isMediaRelevantUrlChange(WATCH, WATCH)).toBe(false);
  });

  it('skips appended volatile params like YouTube &t=', () => {
    expect(isMediaRelevantUrlChange(WATCH, `${WATCH}&t=99s`)).toBe(false);
    expect(isMediaRelevantUrlChange(WATCH, `${WATCH}&t=5s&pp=abc`)).toBe(false);
  });

  it('clears on a changed existing param', () => {
    expect(isMediaRelevantUrlChange(WATCH, 'https://www.youtube.com/watch?v=OTHER123')).toBe(true);
    expect(
      isMediaRelevantUrlChange(
        'https://aniwatch.example/watch/abc?ep=1',
        'https://aniwatch.example/watch/abc?ep=2',
      ),
    ).toBe(true);
  });

  it('clears on a removed param', () => {
    expect(isMediaRelevantUrlChange(`${WATCH}&list=LL`, WATCH)).toBe(true);
  });

  it('clears on path or origin change', () => {
    expect(isMediaRelevantUrlChange(WATCH, 'https://www.youtube.com/shorts/xyz?v=RoBabfioVF8')).toBe(true);
    expect(isMediaRelevantUrlChange(WATCH, 'https://m.youtube.com/watch?v=RoBabfioVF8')).toBe(true);
  });

  it('clears on unparseable input', () => {
    expect(isMediaRelevantUrlChange('not a url', WATCH)).toBe(true);
  });
});
