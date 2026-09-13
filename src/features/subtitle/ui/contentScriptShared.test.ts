import { describe, expect, it } from '@jest/globals';
import { canonicalNavUrl } from './contentScriptShared';

describe('canonicalNavUrl', () => {
  it('collapses volatile YouTube watch params to the video id', () => {
    const a = canonicalNavUrl('https://www.youtube.com/watch?v=YQHsXMglC9A&themeRefresh=1');
    const b = canonicalNavUrl('https://www.youtube.com/watch?v=YQHsXMglC9A');
    expect(a).toBe(b);
  });

  it('drops playlist, tracking and timestamp params on watch URLs', () => {
    const a = canonicalNavUrl('https://www.youtube.com/watch?v=abc123&list=RDabc&start_radio=1&pp=oAcB&t=42s');
    expect(a).toBe('https://www.youtube.com/watch?v=abc123');
  });

  it('keeps different video ids distinct', () => {
    const a = canonicalNavUrl('https://www.youtube.com/watch?v=aaa');
    const b = canonicalNavUrl('https://www.youtube.com/watch?v=bbb');
    expect(a).not.toBe(b);
  });

  it('canonicalizes music.youtube.com watch URLs the same way', () => {
    const a = canonicalNavUrl('https://music.youtube.com/watch?v=abc&list=xyz');
    expect(a).toBe('https://music.youtube.com/watch?v=abc');
  });

  it('uses pathname as identity for non-watch YouTube pages', () => {
    const a = canonicalNavUrl('https://www.youtube.com/shorts/xyz789?feature=share');
    expect(a).toBe('https://www.youtube.com/shorts/xyz789');
    const b = canonicalNavUrl('https://www.youtube.com/results?search_query=hello');
    expect(b).toBe('https://www.youtube.com/results');
  });

  it('leaves non-YouTube URLs untouched', () => {
    const url = 'https://kisskh.co/Drama/episode-5?id=123&utm_source=x';
    expect(canonicalNavUrl(url)).toBe(url);
  });

  it('returns the input for unparseable URLs', () => {
    expect(canonicalNavUrl('not a url')).toBe('not a url');
  });
});
