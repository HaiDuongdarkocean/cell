// resourceClient — contract test for the background proxy.
//
// sendMessage honors the __TihokaSendMessage override hook (showcase/test
// transport); onMessage is a no-op without chrome, so progress push messages
// are unobservable here — the chunk/dedup flow is what matters.

import { gunzipSync } from 'fflate';
import { ReadableStream as NodeReadableStream, CompressionStream as NodeCompressionStream } from 'node:stream/web';
import { listResources, importResourceFile } from './resourceClient';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message';

jest.mock('../logic/signatureGenerator', () => ({
  computeSignature: jest.fn().mockResolvedValue('sig-1'),
}));

type SendOverride = (m: { type: string; payload: Record<string, unknown> }) => Promise<MessageResponse>;
const g = globalThis as {
  __TihokaSendMessage?: SendOverride;
  CompressionStream?: unknown;
  Response?: unknown;
};

const existing = {
  id: 7, name: 'dict.json', langCode: 'en', type: 'DICTIONARY' as const,
  format: 'json' as const, signature: 'sig-1', wordCount: 42,
  installationFinished: true, importedAt: 1,
};

/** ReadableFile-shaped fake — jsdom Blob has no arrayBuffer()/stream(). */
function makeFile(name: string, content: string | Uint8Array, streamable = false) {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  return {
    size: bytes.length,
    name,
    type: 'application/json',
    slice: (start: number, end: number) => ({
      arrayBuffer: async () => bytes.slice(start, end).buffer as ArrayBuffer,
    }),
    ...(streamable
      ? {
          stream: () => new NodeReadableStream({
            start(controller: { enqueue: (b: Uint8Array) => void; close: () => void }) {
              controller.enqueue(bytes);
              controller.close();
            },
          }),
        }
      : {}),
  };
}

/** Minimal Response stand-in: drains a ReadableStream into one ArrayBuffer. */
class CollectResponse {
  private readonly stream: ReadableStream<Uint8Array>;
  constructor(stream: ReadableStream<Uint8Array>) {
    this.stream = stream;
  }
  async arrayBuffer(): Promise<ArrayBuffer> {
    const reader = this.stream.getReader();
    const parts: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out.buffer;
  }
}

interface SentChunk {
  seq: number;
  total: number;
  data: string;
  encoding?: string;
}

function collectChunks() {
  const chunks: SentChunk[] = [];
  g.__TihokaSendMessage = async (m) => {
    if (m.type === MESSAGE_TYPES.RESOURCE_LIST) return { success: true, data: { resources: [] } };
    if (m.type === MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK) {
      const p = m.payload as unknown as SentChunk;
      chunks.push(p);
      return { success: true, data: p.seq === p.total - 1 ? { jobId: 'bg-job-1' } : { received: p.seq + 1 } };
    }
    return { success: true, data: {} };
  };
  return chunks;
}

function joinedBytes(chunks: SentChunk[]): Buffer {
  return Buffer.concat(chunks.map((c) => Buffer.from(c.data, 'base64')));
}

const savedCompressionStream = g.CompressionStream;
const savedResponse = g.Response;

afterEach(() => {
  delete g.__TihokaSendMessage;
  g.CompressionStream = savedCompressionStream;
  g.Response = savedResponse;
});

test('listResources returns resources from the background response', async () => {
  g.__TihokaSendMessage = async (m) => {
    expect(m.type).toBe(MESSAGE_TYPES.RESOURCE_LIST);
    return { success: true, data: { resources: [existing] } };
  };
  await expect(listResources('en')).resolves.toEqual([existing]);
});

test('listResources returns [] when no background is reachable', async () => {
  g.__TihokaSendMessage = async () => undefined as unknown as MessageResponse;
  await expect(listResources('en')).resolves.toEqual([]);
});

test('import skips duplicates without uploading chunks', async () => {
  const sent: string[] = [];
  g.__TihokaSendMessage = async (m) => {
    sent.push(m.type);
    if (m.type === MESSAGE_TYPES.RESOURCE_LIST) return { success: true, data: { resources: [existing] } };
    return { success: true, data: {} };
  };
  const result = await importResourceFile(makeFile('dict.json', '{}'), {
    langCode: 'en',
    onDuplicate: () => 'skip',
  });
  expect(result).toEqual({ skipped: true, existingResource: existing });
  expect(sent).not.toContain(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK);
});

test('import sends the file as chunk(s) and returns the registry jobId', async () => {
  g.__TihokaSendMessage = async (m) => {
    if (m.type === MESSAGE_TYPES.RESOURCE_LIST) return { success: true, data: { resources: [] } };
    if (m.type === MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK) return { success: true, data: { jobId: 'bg-job-1' } };
    return { success: true, data: {} };
  };
  await expect(importResourceFile(makeFile('dict.json', '{"a":1}'), { langCode: 'en' })).resolves.toEqual({ jobId: 'bg-job-1' });
});

test('import without CompressionStream uploads plain chunks reassembling to the file bytes', async () => {
  g.CompressionStream = undefined;
  const chunks = collectChunks();
  const file = makeFile('dict.json', '{"word":"serendipity"}');
  await expect(importResourceFile(file, { langCode: 'en' })).resolves.toEqual({ jobId: 'bg-job-1' });
  expect(chunks.length).toBe(1);
  expect(chunks[0]!.encoding).toBeUndefined();
  expect(joinedBytes(chunks).toString('utf8')).toBe('{"word":"serendipity"}');
});

test('import with CompressionStream uploads gzip chunks reassembling to the file bytes', async () => {
  g.CompressionStream = NodeCompressionStream;
  g.Response = CollectResponse;
  const chunks = collectChunks();
  const file = makeFile('dict.json', '{"word":"serendipity"}', true);
  await expect(importResourceFile(file, { langCode: 'en' })).resolves.toEqual({ jobId: 'bg-job-1' });
  expect(chunks.length).toBe(1);
  expect(chunks.every((c) => c.encoding === 'gzip')).toBe(true);
  const raw = gunzipSync(new Uint8Array(joinedBytes(chunks)));
  expect(Buffer.from(raw).toString('utf8')).toBe('{"word":"serendipity"}');
});

test('import falls back to plain chunks when the file cannot stream', async () => {
  g.CompressionStream = NodeCompressionStream;
  const chunks = collectChunks();
  const file = makeFile('dict.json', '{"word":"serendipity"}');
  await expect(importResourceFile(file, { langCode: 'en' })).resolves.toEqual({ jobId: 'bg-job-1' });
  expect(chunks[0]!.encoding).toBeUndefined();
  expect(joinedBytes(chunks).toString('utf8')).toBe('{"word":"serendipity"}');
});

test('import uploads chunks with an in-flight window and collects jobId from any response', async () => {
  g.CompressionStream = undefined;
  const chunks: SentChunk[] = [];
  const pendingResolvers: ((res: MessageResponse) => void)[] = [];
  g.__TihokaSendMessage = (m) => {
    if (m.type === MESSAGE_TYPES.RESOURCE_LIST) {
      return Promise.resolve({ success: true, data: { resources: [] } });
    }
    if (m.type === MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK) {
      chunks.push(m.payload as unknown as SentChunk);
      return new Promise<MessageResponse>((resolve) => {
        pendingResolvers.push(resolve);
      });
    }
    return Promise.resolve({ success: true, data: {} });
  };
  const bytes = new TextEncoder().encode('x');
  const file = {
    size: 14 * 1024 * 1024,
    name: 'dict.json',
    type: 'application/json',
    slice: (start: number, end: number) => ({
      arrayBuffer: async () => bytes.slice(start, Math.min(end, bytes.length)).buffer as ArrayBuffer,
    }),
  };
  const waitFor = async (cond: () => boolean) => {
    for (let i = 0; i < 100 && !cond(); i += 1) await new Promise((r) => setTimeout(r, 0));
    expect(cond()).toBe(true);
  };

  const promise = importResourceFile(file, { langCode: 'en' });
  await waitFor(() => pendingResolvers.length === 4);
  await new Promise((r) => setTimeout(r, 10));
  expect(chunks.map((c) => c.seq)).toEqual([0, 1, 2, 3]);

  pendingResolvers.shift()!({ success: true, data: { received: 1 } });
  await waitFor(() => chunks.length === 5 && pendingResolvers.length === 4);
  expect(chunks[4]!.seq).toBe(4);

  pendingResolvers.shift()!({ success: true, data: { jobId: 'bg-job-1' } });
  for (let i = 0; i < 10 && pendingResolvers.length > 0; i += 1) {
    for (const resolve of pendingResolvers.splice(0)) {
      resolve({ success: true, data: { received: 1 } });
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  await expect(promise).resolves.toEqual({ jobId: 'bg-job-1' });
});
