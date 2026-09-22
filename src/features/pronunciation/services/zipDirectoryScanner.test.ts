import { zipSync, strToU8 } from 'fflate';
import { scanZipDirectory, scanZipEntryForPath } from './zipDirectoryScanner';

function makeZip(entries: Record<string, Uint8Array>): File {
  return new File([zipSync(entries)], 'pkg.zip');
}

describe('scanZipDirectory', () => {
  it('extracts offset/compressedSize/method for each entry', async () => {
    const file = makeZip({
      'audio/hello.mp3': strToU8('hello-bytes'),
      'audio/world.mp3': strToU8('world-bytes-2'),
    });
    const entries = await scanZipDirectory(file);
    expect(Object.keys(entries).sort()).toEqual(['audio/hello.mp3', 'audio/world.mp3']);
    const hello = entries['audio/hello.mp3'];
    expect(hello.method).toBe(8);
    expect(hello.compressedSize).toBeGreaterThan(0);
    expect(hello.offset).toBe(0);
    const world = entries['audio/world.mp3'];
    expect(world.offset).toBeGreaterThan(0);
  });

  it('skips directory entries', async () => {
    const file = makeZip({
      'audio/': new Uint8Array(),
      'audio/hello.mp3': strToU8('x'),
    });
    const entries = await scanZipDirectory(file);
    expect(Object.keys(entries)).toEqual(['audio/hello.mp3']);
  });

  it('throws on a non-zip file', async () => {
    const file = new File([strToU8('not a zip at all')], 'x.bin');
    await expect(scanZipDirectory(file)).rejects.toThrow('EOCD');
  });
});

describe('scanZipEntryForPath', () => {
  const file = makeZip({
    'audio/hello.mp3': strToU8('hello-bytes'),
    'en/user/hello.mp3': strToU8('other-hello'),
    'other.mp3': strToU8('x'),
  });

  it('finds an entry by exact path without decoding names', async () => {
    const meta = await scanZipEntryForPath(file, 'audio/hello.mp3');
    expect(meta).toBeDefined();
    expect(meta!.method).toBe(8);
    expect(meta!.offset).toBe(0);
  });

  it('falls back to basename match', async () => {
    const meta = await scanZipEntryForPath(file, 'HELLO.MP3');
    expect(meta).toBeDefined();
    expect(meta!.offset).toBe(0);
  });

  it('returns undefined for a missing path', async () => {
    const meta = await scanZipEntryForPath(file, 'missing/none.mp3');
    expect(meta).toBeUndefined();
  });

  it('throws on a non-zip file', async () => {
    const bad = new File([strToU8('nope')], 'x.bin');
    await expect(scanZipEntryForPath(bad, 'a.mp3')).rejects.toThrow('EOCD');
  });
});
