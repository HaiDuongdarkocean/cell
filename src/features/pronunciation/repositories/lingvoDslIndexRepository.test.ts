import 'fake-indexeddb/auto';
import {
  saveLingvoDslIndex,
  getLingvoDslAudioPaths,
  clearLingvoDslIndex,
} from './lingvoDslIndexRepository';
import type { LingvoDslIndexEntry } from '../services/lingvoDslParser';

function makeEntry(packageId: string, term: string, audioPaths: string[]): LingvoDslIndexEntry {
  return { id: `${packageId}:${term}`, packageId, term, audioPaths };
}

describe('lingvoDslIndexRepository', () => {
  beforeEach(async () => {
    await clearLingvoDslIndex('pkg-a');
    await clearLingvoDslIndex('pkg-b');
  });

  it('saves and retrieves index entries', async () => {
    await saveLingvoDslIndex('pkg-a', [
      makeEntry('pkg-a', 'hello', ['hello.mp3']),
      makeEntry('pkg-a', 'world', ['world1.mp3', 'world2.mp3']),
    ]);

    expect(await getLingvoDslAudioPaths('pkg-a', 'hello')).toEqual(['hello.mp3']);
    expect(await getLingvoDslAudioPaths('pkg-a', 'world')).toEqual(['world1.mp3', 'world2.mp3']);
  });

  it('returns undefined for unknown terms', async () => {
    expect(await getLingvoDslAudioPaths('pkg-a', 'missing')).toBeUndefined();
  });

  it('is scoped by package id', async () => {
    await saveLingvoDslIndex('pkg-a', [makeEntry('pkg-a', 'hello', ['a.mp3'])]);
    await saveLingvoDslIndex('pkg-b', [makeEntry('pkg-b', 'hello', ['b.mp3'])]);

    expect(await getLingvoDslAudioPaths('pkg-a', 'hello')).toEqual(['a.mp3']);
    expect(await getLingvoDslAudioPaths('pkg-b', 'hello')).toEqual(['b.mp3']);
  });

  it('overwrites existing entries', async () => {
    await saveLingvoDslIndex('pkg-a', [makeEntry('pkg-a', 'hello', ['old.mp3'])]);
    await saveLingvoDslIndex('pkg-a', [makeEntry('pkg-a', 'hello', ['new.mp3'])]);

    expect(await getLingvoDslAudioPaths('pkg-a', 'hello')).toEqual(['new.mp3']);
  });

  it('clears only entries for a package', async () => {
    await saveLingvoDslIndex('pkg-a', [makeEntry('pkg-a', 'hello', ['a.mp3'])]);
    await saveLingvoDslIndex('pkg-b', [makeEntry('pkg-b', 'hello', ['b.mp3'])]);

    await clearLingvoDslIndex('pkg-a');

    expect(await getLingvoDslAudioPaths('pkg-a', 'hello')).toBeUndefined();
    expect(await getLingvoDslAudioPaths('pkg-b', 'hello')).toEqual(['b.mp3']);
  });
});
