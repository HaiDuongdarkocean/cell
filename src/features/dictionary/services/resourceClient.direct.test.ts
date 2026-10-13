/**
 * @jest-environment-options {"url": "chrome-extension://ifceodogdeeaacmdigljgmafnhkbfnia/popup.html"}
 *
 * Direct File handoff — extension-origin senders (popup) skip byte chunks:
 * RESOURCE_IMPORT_BEGIN registers the job, then the File rides
 * BroadcastChannel('Tihoka-import') straight to the offscreen runner. Any
 * begin failure must fall back to the chunk path under the same jobId.
 */

import { importResourceFile } from './resourceClient';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message';
import type { ImportRunRequest } from '../logic/importChannel';
import type { ReadableFile } from '../logic/fileDetector';

jest.mock('../logic/signatureGenerator', () => ({
  computeSignature: jest.fn().mockResolvedValue('sig-1'),
}));

type SendOverride = (m: { type: string; payload: Record<string, unknown> }) => Promise<MessageResponse>;
const g = globalThis as {
  __TihokaSendMessage?: SendOverride;
  BroadcastChannel?: unknown;
};

const posted: unknown[] = [];
class FakeChannel {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage(message: unknown): void {
    posted.push(message);
  }
  close(): void {}
}

const savedBroadcastChannel = g.BroadcastChannel;

beforeEach(() => {
  posted.length = 0;
  g.BroadcastChannel = FakeChannel;
});

afterEach(() => {
  delete g.__TihokaSendMessage;
  g.BroadcastChannel = savedBroadcastChannel;
});

function makeRealFile(name: string, content: string): ReadableFile {
  const bytes = new TextEncoder().encode(content);
  const file = new File([content], name, { type: 'application/json' });
  // jsdom Blob.slice returns a Blob without arrayBuffer() — patch the
  // instance so the chunk fallback can read slices like a real File.
  Object.defineProperty(file, 'slice', {
    value: (start: number, end: number) => ({
      arrayBuffer: async () => bytes.slice(start, Math.min(end, bytes.length)).buffer as ArrayBuffer,
    }),
  });
  return file as unknown as ReadableFile;
}

test('extension-origin import posts import-run on the channel after a successful begin', async () => {
  const sent: { type: string; payload: Record<string, unknown> }[] = [];
  g.__TihokaSendMessage = async (m) => {
    sent.push(m);
    if (m.type === MESSAGE_TYPES.RESOURCE_LIST) return { success: true, data: { resources: [] } };
    if (m.type === MESSAGE_TYPES.RESOURCE_IMPORT_BEGIN) {
      return { success: true, data: { direct: true, jobId: 'bg-job-1' } };
    }
    return { success: true, data: {} };
  };

  const file = makeRealFile('dict.json', '{"a":1}');
  const progress: [number, number][] = [];
  await expect(
    importResourceFile(file, {
      langCode: 'en',
      onUploadProgress: (s, total) => progress.push([s, total]),
    }),
  ).resolves.toEqual({ jobId: 'bg-job-1' });

  const begin = sent.find((m) => m.type === MESSAGE_TYPES.RESOURCE_IMPORT_BEGIN);
  expect(begin?.payload).toMatchObject({ fileName: 'dict.json', langCode: 'en', signature: 'sig-1' });
  expect(sent.some((m) => m.type === MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)).toBe(false);
  expect(posted).toHaveLength(1);
  const run = posted[0] as ImportRunRequest;
  expect(run).toMatchObject({ type: 'import-run', jobId: 'bg-job-1', langCode: 'en', signature: 'sig-1' });
  expect(run.file).toBe(file);
  expect(progress).toEqual([[1, 1]]);
});

test('begin passes through a resolved replace decision', async () => {
  const existing = {
    id: 7, name: 'dict.json', langCode: 'en', type: 'DICTIONARY' as const,
    format: 'json' as const, signature: 'sig-1', wordCount: 42,
    installationFinished: true, importedAt: 1,
  };
  g.__TihokaSendMessage = async (m) => {
    if (m.type === MESSAGE_TYPES.RESOURCE_LIST) return { success: true, data: { resources: [existing] } };
    if (m.type === MESSAGE_TYPES.RESOURCE_IMPORT_BEGIN) {
      return { success: true, data: { direct: true, jobId: 'bg-job-2' } };
    }
    return { success: true, data: {} };
  };

  await expect(
    importResourceFile(makeRealFile('dict.json', '{"a":1}'), {
      langCode: 'en',
      onDuplicate: () => 'replace',
    }),
  ).resolves.toEqual({ jobId: 'bg-job-2' });
  const run = posted[0] as ImportRunRequest;
  expect(run.duplicateDecision).toBe('replace');
});

test('falls back to chunk upload when begin fails', async () => {
  const sent: { type: string; payload: Record<string, unknown> }[] = [];
  g.__TihokaSendMessage = async (m) => {
    sent.push(m);
    if (m.type === MESSAGE_TYPES.RESOURCE_LIST) return { success: true, data: { resources: [] } };
    if (m.type === MESSAGE_TYPES.RESOURCE_IMPORT_BEGIN) {
      return { success: false, error: 'offscreen unavailable' };
    }
    if (m.type === MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK) {
      return { success: true, data: { jobId: 'bg-job-3' } };
    }
    return { success: true, data: {} };
  };

  await expect(importResourceFile(makeRealFile('dict.json', '{"a":1}'), { langCode: 'en' })).resolves.toEqual({ jobId: 'bg-job-3' });
  expect(sent.some((m) => m.type === MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK)).toBe(true);
  expect(posted).toHaveLength(0);
});
