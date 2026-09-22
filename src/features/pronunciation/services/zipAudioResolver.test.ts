import { zipSync, strToU8 } from 'fflate';
import {
  SingleZipAudioResolver,
  SplitZipAudioResolver,
} from './zipAudioResolver';

if (typeof globalThis.DecompressionStream === 'undefined') {
  const { DecompressionStream } = require('stream/web');
  (globalThis as Record<string, unknown>).DecompressionStream = DecompressionStream;
}

function makeZip(entries: Record<string, Uint8Array>): File {
  const zipped = zipSync(entries);
  return new File([zipped], 'ForvoEnglish.dsl.files.zip', { type: 'application/zip' });
}

function makeDirHandle(entries: Record<string, File>): FileSystemDirectoryHandle {
  return {
    async getFileHandle(name: string) {
      const file = entries[name];
      if (!file) throw new Error(`file not found: ${name}`);
      return {
        async getFile() { return file; },
      } as unknown as FileSystemFileHandle;
    },
  } as unknown as FileSystemDirectoryHandle;
}

describe('SingleZipAudioResolver', () => {
  it('resolves an audio file by exact path', async () => {
    const file = makeZip({ 'hello.mp3': strToU8('mp3-bytes') });
    const resolver = new SingleZipAudioResolver(async () => file);
    const bytes = await resolver.resolveAudio('hello', 'hello.mp3');
    expect(bytes).toBeDefined();
    expect(bytes!.length).toBe(9);
  });

  it('resolves an audio file by basename if the path differs', async () => {
    const file = makeZip({ 'audio/world.mp3': strToU8('mp3-bytes-for-world') });
    const resolver = new SingleZipAudioResolver(async () => file);
    const bytes = await resolver.resolveAudio('world', 'world.mp3');
    expect(bytes).toBeDefined();
    expect(bytes!.length).toBe(19);
  });

  it('returns undefined when the audio path is not in the archive', async () => {
    const file = makeZip({ 'other.mp3': strToU8('x') });
    const resolver = new SingleZipAudioResolver(async () => file);
    const bytes = await resolver.resolveAudio('missing', 'missing.mp3');
    expect(bytes).toBeUndefined();
  });
});

describe('resolveAudios batch', () => {
  it('resolves multiple paths in one call', async () => {
    const file = makeZip({
      'a/one.mp3': strToU8('one-bytes'),
      'b/two.mp3': strToU8('two-bytes-2'),
    });
    const resolver = new SingleZipAudioResolver(async () => file);
    const results = await resolver.resolveAudios!('term', [
      'a/one.mp3',
      'b/two.mp3',
      'missing.mp3',
    ]);
    expect(results[0]).toBeDefined();
    expect(results[1]).toBeDefined();
    expect(results[2]).toBeUndefined();
    expect(Array.from(results[0]!)).toEqual(Array.from(strToU8('one-bytes')));
    expect(Array.from(results[1]!)).toEqual(Array.from(strToU8('two-bytes-2')));
  });

  it('serves repeated lookups from the memoized match', async () => {
    const file = makeZip({ 'audio/hello.mp3': strToU8('hello-bytes') });
    const resolver = new SingleZipAudioResolver(async () => file);
    const first = await resolver.resolveAudio('hello', 'audio/hello.mp3');
    const second = await resolver.resolveAudio('hello', 'audio/hello.mp3');
    expect(first).toBeDefined();
    expect(Array.from(second!)).toEqual(Array.from(strToU8('hello-bytes')));
  });
});

describe('SplitZipAudioResolver', () => {
  it('resolves audio from the correct first-letter archive', async () => {
    const hZip = makeZip({ 'hello.mp3': strToU8('hello-bytes') });
    const wZip = makeZip({ 'world.mp3': strToU8('world-bytes') });
    const dir = makeDirHandle({ 'ForvoEnglish_h.zip': hZip, 'ForvoEnglish_w.zip': wZip });
    const resolver = new SplitZipAudioResolver(dir, 'ForvoEnglish_{firstLetter}.zip');

    const helloBytes = await resolver.resolveAudio('hello', 'hello.mp3');
    expect(helloBytes).toBeDefined();
    expect(helloBytes!.length).toBe(11);

    const worldBytes = await resolver.resolveAudio('world', 'world.mp3');
    expect(worldBytes).toBeDefined();
    expect(worldBytes!.length).toBe(11);
  });

  it('returns undefined when the archive for the first letter is missing', async () => {
    const dir = makeDirHandle({});
    const resolver = new SplitZipAudioResolver(dir, 'ForvoEnglish_{firstLetter}.zip');
    const bytes = await resolver.resolveAudio('hello', 'hello.mp3');
    expect(bytes).toBeUndefined();
  });

  it('resolves entries grouped by first letter in split package output', async () => {
    const aZip = makeZip({ 'audio/apple.mp3': strToU8('apple-bytes') });
    const hZip = makeZip({ 'audio/hello.mp3': strToU8('hello-bytes') });
    const wZip = makeZip({ 'audio/world.mp3': strToU8('world-bytes') });
    const dir = makeDirHandle({
      'ForvoEnglish_a.zip': aZip,
      'ForvoEnglish_h.zip': hZip,
      'ForvoEnglish_w.zip': wZip,
    });
    const resolver = new SplitZipAudioResolver(dir, 'ForvoEnglish_{firstLetter}.zip');

    const apple = await resolver.resolveAudio('apple', 'audio/apple.mp3');
    expect(apple).toBeDefined();
    expect(apple!.length).toBe(11);

    const world = await resolver.resolveAudio('world', 'audio/world.mp3');
    expect(world).toBeDefined();
    expect(world!.length).toBe(11);
  });
});
