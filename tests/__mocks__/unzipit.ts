/**
 * Jest mock for `unzipit`.
 *
 * unzipit's real build uses `DecompressionStream`, which is not available in
 * the Node/jsdom test environment. This mock uses `fflate` to unzip files and
 * present the same `ZipInfo` / `ZipEntry` API so resolver tests still exercise
 * zip extraction.
 */

import { unzipSync, strFromU8 } from 'fflate';

class MockZipEntry {
  readonly name: string;
  readonly size: number;
  readonly compressedSize: number;
  readonly comment = '';
  readonly commentBytes = new Uint8Array();
  readonly compressionMethod = 8;
  readonly lastModDate = new Date();
  readonly isDirectory: boolean;
  readonly encrypted = false;
  readonly externalFileAttributes = 0;
  readonly versionMadeBy = 20;

  private readonly data: Uint8Array;

  constructor(name: string, data: Uint8Array) {
    this.name = name;
    this.data = data;
    this.size = data.length;
    this.compressedSize = data.length;
    this.isDirectory = name.endsWith('/');
  }

  async blob(type?: string): Promise<Blob> {
    const buffer = await this.arrayBuffer();
    return new Blob([buffer], { type });
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return (this.data.buffer as ArrayBuffer).slice(
      this.data.byteOffset,
      this.data.byteOffset + this.data.byteLength,
    );
  }

  async text(): Promise<string> {
    return strFromU8(this.data);
  }

  async json(): Promise<unknown> {
    return JSON.parse(strFromU8(this.data));
  }
}

async function readSource(source: unknown): Promise<Uint8Array> {
  if (source instanceof File || source instanceof Blob) {
    const asBlob = source as Blob;
    if (asBlob.arrayBuffer) {
      const buffer = await asBlob.arrayBuffer();
      return new Uint8Array(buffer);
    }
    // jsdom Blob may not expose arrayBuffer(); fall back to FileReader.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = reject;
      reader.readAsArrayBuffer(asBlob);
    });
  }
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }
  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }
  throw new Error('Unsupported source type for mock unzipit');
}

export async function unzip(source: unknown): Promise<{ zip: { comment: string; commentBytes: Uint8Array }; entries: Record<string, MockZipEntry> }> {
  const data = await readSource(source);
  const files = unzipSync(data);
  const entries: Record<string, MockZipEntry> = {};
  for (const [name, bytes] of Object.entries(files)) {
    entries[name] = new MockZipEntry(name, bytes);
  }
  return {
    zip: { comment: '', commentBytes: new Uint8Array() },
    entries,
  };
}

export async function unzipRaw(source: unknown): Promise<{ zip: { comment: string; commentBytes: Uint8Array }; entriesArray: MockZipEntry[] }> {
  const { zip, entries } = await unzip(source);
  return { zip, entriesArray: Object.values(entries) };
}

export function setOptions(_options: unknown): void {}
export function cleanup(): void {}
