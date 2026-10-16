// importStreams — chunked byte/text plumbing for dictionary import.
//
// importFile used to hold ~4-6× file size in RAM: full bytes → all inflated
// zip entries → one decoded string → one parsed graph, with multi-hundred-ms
// synchronous decompress/parse bursts. Every stage here streams: 4MB file
// slices → fflate Gunzip/Unzip chunks → TextDecoder(stream) — so peak memory
// stays near one chunk plus the largest single entry and no synchronous
// block exceeds a chunk of work.
//
// File reads go through ReadableFile.slice (the interface already required
// for signatures) — real File/Blob sources and in-memory test sources share
// the same code path via fileFromBytes.

import { Gunzip, Unzip, UnzipInflate } from 'fflate';
import { CorruptedFileError } from './importErrors';
import { isGzip, isImportZipEntry, isZip } from './fileDetector';
import type { ReadableFile } from './fileDetector';

const FILE_CHUNK_BYTES = 4 * 1024 * 1024;

/** Wrap an in-memory buffer as a ReadableFile (tests, bundled seeds). */
export function fileFromBytes(data: Uint8Array, name: string): ReadableFile {
  return {
    size: data.length,
    name,
    slice: (start, end) => ({
      arrayBuffer: async () => data.slice(start, end).buffer as ArrayBuffer,
    }),
  };
}

/** File → async chunks via slice+arrayBuffer (bounded memory, real backpressure). */
export async function* streamFileChunks(
  file: ReadableFile,
  chunkSize = FILE_CHUNK_BYTES,
): AsyncGenerator<Uint8Array> {
  for (let off = 0; off < file.size; off += chunkSize) {
    const end = Math.min(off + chunkSize, file.size);
    const buffer = await file.slice(off, end).arrayBuffer();
    if (buffer.byteLength > 0) yield new Uint8Array(buffer);
  }
}

/** Streaming gunzip over a byte-chunk stream (fflate Gunzip). */
export async function* streamGunzipChunks(
  chunks: AsyncIterable<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  const gz = new Gunzip();
  const out: Uint8Array[] = [];
  let streamErr: unknown;
  gz.ondata = (chunk) => out.push(chunk);
  const push = (chunk: Uint8Array, final?: boolean): void => {
    try {
      gz.push(chunk, final);
    } catch (e) {
      streamErr = e;
    }
  };
  for await (const chunk of chunks) {
    push(chunk);
    while (out.length) yield out.shift()!;
    if (streamErr) throw new CorruptedFileError('gunzip failed — corrupt gzip data', streamErr);
  }
  push(new Uint8Array(0), true);
  while (out.length) yield out.shift()!;
  if (streamErr) throw new CorruptedFileError('gunzip failed — corrupt gzip data', streamErr);
}

/** Byte source for a plain file: gunzip when the stream starts with gzip magic. */
export async function* streamByteSource(file: ReadableFile): AsyncGenerator<Uint8Array> {
  const it = streamFileChunks(file)[Symbol.asyncIterator]();
  const first = await it.next();
  if (first.done) return;
  const rest = (async function* (): AsyncGenerator<Uint8Array> {
    yield first.value;
    for (;;) {
      const next = await it.next();
      if (next.done) return;
      yield next.value;
    }
  })();
  if (isGzip(first.value)) yield* streamGunzipChunks(rest);
  else yield* rest;
}

/** Gunzip just enough bytes for a head sniff (format detection inside .gz). */
export async function gunzipHead(file: ReadableFile, maxBytes = 1024 * 1024): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of streamGunzipChunks(streamFileChunks(file))) {
    const take = Math.min(chunk.length, maxBytes - size);
    if (take > 0) {
      parts.push(chunk.slice(0, take));
      size += take;
    }
    if (size >= maxBytes) break;
  }
  return concatBytes(parts);
}

export type ZipStreamEvent =
  | { readonly type: 'start'; readonly name: string; readonly originalSize?: number }
  | { readonly type: 'data'; readonly chunk: Uint8Array }
  | { readonly type: 'end'; readonly name: string }
  | { readonly type: 'error'; readonly name: string; readonly err: unknown };

/** Zip → ordered entry events. Entries failing keepEntry are never inflated
 *  (not started) — same semantics as unzipSync's filter. Chunk queues stay
 *  bounded because events drain between source pushes. */
export async function* streamZipEvents(
  file: ReadableFile,
  keepEntry?: (name: string) => boolean,
): AsyncGenerator<ZipStreamEvent> {
  const uz = new Unzip();
  uz.register(UnzipInflate);
  const events: ZipStreamEvent[] = [];
  let streamErr: unknown;
  uz.onfile = (zf) => {
    if (keepEntry && !keepEntry(zf.name)) return;
    events.push({ type: 'start', name: zf.name, originalSize: zf.originalSize });
    zf.ondata = (err, chunk, final) => {
      if (err) {
        events.push({ type: 'error', name: zf.name, err });
        return;
      }
      if (chunk.length > 0) events.push({ type: 'data', chunk });
      if (final) events.push({ type: 'end', name: zf.name });
    };
    try {
      zf.start();
    } catch (e) {
      events.push({ type: 'error', name: zf.name, err: e });
    }
  };
  const push = (chunk: Uint8Array, final?: boolean): void => {
    try {
      uz.push(chunk, final);
    } catch (e) {
      streamErr = e;
    }
  };
  for await (const slice of streamFileChunks(file)) {
    push(slice);
    while (events.length) yield events.shift()!;
    if (streamErr) throw new CorruptedFileError('unzip failed — corrupt zip data', streamErr);
  }
  push(new Uint8Array(0), true);
  while (events.length) yield events.shift()!;
  if (streamErr) throw new CorruptedFileError('unzip failed — corrupt zip data', streamErr);
}

/** Pull the open entry's byte chunks off a shared zip-event iterator until its
 *  'end' event. Entries arrive sequentially, never interleaved. */
export async function* entryByteStream(
  events: AsyncIterator<ZipStreamEvent>,
): AsyncGenerator<Uint8Array> {
  for (;;) {
    const next = await events.next();
    if (next.done) throw new CorruptedFileError('unzip failed — truncated entry data');
    const ev = next.value;
    if (ev.type === 'end') return;
    if (ev.type === 'error') {
      throw new CorruptedFileError(`unzip failed — entry "${ev.name}" inflate error`, ev.err);
    }
    if (ev.type === 'data') yield ev.chunk;
  }
}

/** One entry's bytes by name — pass 2 of a zip container. Other kept entries
 *  are still inflated by the stream but skipped (their events are drained). */
export async function* zipEntryBytes(
  file: ReadableFile,
  entryName: string,
  keepEntry = isImportZipEntry,
): AsyncGenerator<Uint8Array> {
  const it = streamZipEvents(file, keepEntry)[Symbol.asyncIterator]();
  for (;;) {
    const next = await it.next();
    if (next.done) throw new CorruptedFileError(`zip entry "${entryName}" not found`);
    const ev = next.value;
    if (ev.type === 'error') {
      throw new CorruptedFileError(`unzip failed — entry "${ev.name}" inflate error`, ev.err);
    }
    if (ev.type !== 'start' || ev.name !== entryName) {
      if (ev.type === 'start') for await (const _ of entryByteStream(it)) void _;
      continue;
    }
    yield* entryByteStream(it);
    return;
  }
}

const MANIFEST_HEAD_BYTES = 64 * 1024;
const MANIFEST_FULL_BYTES = 1024 * 1024;

/** Streamed replacement for unzipAll at sniff time: every kept entry mapped
 *  to a head slice (64KB). Small entries (index.json) arrive complete. */
export async function readZipManifest(
  file: ReadableFile,
  keepEntry = isImportZipEntry,
): Promise<Record<string, Uint8Array>> {
  const manifest: Record<string, Uint8Array> = {};
  const it = streamZipEvents(file, keepEntry)[Symbol.asyncIterator]();
  for (;;) {
    const next = await it.next();
    if (next.done) break;
    const ev = next.value;
    if (ev.type === 'error') {
      throw new CorruptedFileError(`unzip failed — entry "${ev.name}" inflate error`, ev.err);
    }
    if (ev.type !== 'start') continue;
    const parts: Uint8Array[] = [];
    let size = 0;
    const cap = ev.name.endsWith('index.json') ? MANIFEST_FULL_BYTES : MANIFEST_HEAD_BYTES;
    for await (const chunk of entryByteStream(it)) {
      const take = Math.min(chunk.length, cap - size);
      if (take > 0) {
        parts.push(chunk.slice(0, take));
        size += take;
      }
    }
    manifest[ev.name] = concatBytes(parts);
  }
  return manifest;
}

/** Uint8Array chunks → UTF-16 strings; split multibyte sequences stay glued
 *  across chunk boundaries (TextDecoder stream mode). */
export async function* streamTextChunks(
  chunks: AsyncIterable<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  for await (const chunk of chunks) {
    const text = decoder.decode(chunk, { stream: true });
    if (text) yield text;
  }
  const tail = decoder.decode();
  if (tail) yield tail;
}

/** Full text of a byte stream — error paths only (e.g. distinguishing
 *  "valid JSON, not an array" from malformed JSON). Never on the hot path. */
export async function readAllText(chunks: AsyncIterable<Uint8Array>): Promise<string> {
  let text = '';
  for await (const chunk of streamTextChunks(chunks)) text += chunk;
  return text;
}

/** Text chunks → lines (\n-separated; \r trimmed downstream as before). */
export async function* iterTextLines(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  let buf = '';
  for await (const chunk of chunks) {
    buf += chunk;
    let idx = buf.indexOf('\n');
    while (idx >= 0) {
      yield buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      idx = buf.indexOf('\n');
    }
  }
  if (buf.length > 0) yield buf;
}

/** What strategies receive — `file` streams in production; `data` wraps an
 *  in-memory buffer (tests, bundled seeds) through the same chunked path. */
export interface ImportSourceInput {
  readonly data?: Uint8Array;
  readonly file?: ReadableFile;
  readonly fileName: string;
  /** Orchestrator's pass-1 zip manifest (name → ≤64KB head, index.json full)
   *  when the source is a zip — saves the strategy a second sniff pass. */
  readonly zipManifest?: Record<string, Uint8Array>;
}

/** Normalize to a ReadableFile + the zip manifest (null when not a zip).
 *  A gzipped zip resolves through its inflated bytes (rare edge — the old
 *  path materialized it the same way). */
export async function resolveImportSource(input: ImportSourceInput): Promise<{
  file: ReadableFile;
  manifest: Record<string, Uint8Array> | null;
}> {
  const file = input.file ?? fileFromBytes(input.data ?? new Uint8Array(0), input.fileName);
  if (input.zipManifest) return { file, manifest: input.zipManifest };
  const head = new Uint8Array(await file.slice(0, Math.min(4, file.size)).arrayBuffer());
  if (isZip(head)) return { file, manifest: await readZipManifest(file) };
  if (isGzip(head)) {
    const innerHead = await gunzipHead(file, 4);
    if (isZip(innerHead)) {
      const parts: Uint8Array[] = [];
      for await (const chunk of streamGunzipChunks(streamFileChunks(file))) parts.push(chunk);
      const inflated = fileFromBytes(concatBytes(parts), input.fileName);
      return { file: inflated, manifest: await readZipManifest(inflated) };
    }
  }
  return { file, manifest: null };
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0]!;
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const part of parts) {
    out.set(part, off);
    off += part.length;
  }
  return out;
}
