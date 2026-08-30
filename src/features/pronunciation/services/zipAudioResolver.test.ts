import { zipSync, strToU8 } from 'fflate';
import { SingleZipAudioResolver, SplitZipAudioResolver } from './zipAudioResolver';

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
    const blob = await resolver.resolveAudio('hello', 'hello.mp3');
    expect(blob).toBeDefined();
    expect(blob!.size).toBe(9);
  });

  it('resolves an audio file by basename if the path differs', async () => {
    const file = makeZip({ 'audio/world.mp3': strToU8('mp3-bytes-for-world') });
    const resolver = new SingleZipAudioResolver(async () => file);
    const blob = await resolver.resolveAudio('world', 'world.mp3');
    expect(blob).toBeDefined();
    expect(blob!.size).toBe(19);
  });

  it('returns undefined when the audio path is not in the archive', async () => {
    const file = makeZip({ 'other.mp3': strToU8('x') });
    const resolver = new SingleZipAudioResolver(async () => file);
    const blob = await resolver.resolveAudio('missing', 'missing.mp3');
    expect(blob).toBeUndefined();
  });
});

describe('SplitZipAudioResolver', () => {
  it('resolves audio from the correct first-letter archive', async () => {
    const hZip = makeZip({ 'hello.mp3': strToU8('hello-bytes') });
    const wZip = makeZip({ 'world.mp3': strToU8('world-bytes') });
    const dir = makeDirHandle({ 'ForvoEnglish_h.zip': hZip, 'ForvoEnglish_w.zip': wZip });
    const resolver = new SplitZipAudioResolver(dir, 'ForvoEnglish_{firstLetter}.zip');

    const helloBlob = await resolver.resolveAudio('hello', 'hello.mp3');
    expect(helloBlob).toBeDefined();
    expect(helloBlob!.size).toBe(11);

    const worldBlob = await resolver.resolveAudio('world', 'world.mp3');
    expect(worldBlob).toBeDefined();
    expect(worldBlob!.size).toBe(11);
  });

  it('returns undefined when the archive for the first letter is missing', async () => {
    const dir = makeDirHandle({});
    const resolver = new SplitZipAudioResolver(dir, 'ForvoEnglish_{firstLetter}.zip');
    const blob = await resolver.resolveAudio('hello', 'hello.mp3');
    expect(blob).toBeUndefined();
  });
});
