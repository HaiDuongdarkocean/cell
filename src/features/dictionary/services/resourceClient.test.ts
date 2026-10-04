// resourceClient — contract test for the background proxy.
//
// sendMessage honors the __cellSendMessage override hook (showcase/test
// transport); onMessage is a no-op without chrome, so progress push messages
// are unobservable here — the chunk/dedup flow is what matters.

import { listResources, importResourceFile } from './resourceClient';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message';

jest.mock('../logic/signatureGenerator', () => ({
  computeSignature: jest.fn().mockResolvedValue('sig-1'),
}));

type SendOverride = (m: { type: string; payload: Record<string, unknown> }) => Promise<MessageResponse>;
const g = globalThis as { __cellSendMessage?: SendOverride };

const existing = {
  id: 7, name: 'dict.json', langCode: 'en', type: 'DICTIONARY' as const,
  format: 'json' as const, signature: 'sig-1', wordCount: 42,
  installationFinished: true, importedAt: 1,
};

afterEach(() => { delete g.__cellSendMessage; });

test('listResources returns resources from the background response', async () => {
  g.__cellSendMessage = async (m) => {
    expect(m.type).toBe(MESSAGE_TYPES.RESOURCE_LIST);
    return { success: true, data: { resources: [existing] } };
  };
  await expect(listResources('en')).resolves.toEqual([existing]);
});

test('listResources returns [] when no background is reachable', async () => {
  g.__cellSendMessage = async () => undefined as unknown as MessageResponse;
  await expect(listResources('en')).resolves.toEqual([]);
});

test('import skips duplicates without uploading chunks', async () => {
  const sent: string[] = [];
  g.__cellSendMessage = async (m) => {
    sent.push(m.type);
    if (m.type === MESSAGE_TYPES.RESOURCE_LIST) return { success: true, data: { resources: [existing] } };
    return { success: true, data: {} };
  };
  const file = new File(['{}'], 'dict.json', { type: 'application/json' });
  const result = await importResourceFile(file, {
    langCode: 'en',
    onDuplicate: () => 'skip',
  });
  expect(result).toEqual({ skipped: true, existingResource: existing });
  expect(sent).not.toContain(MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK);
});

test('import sends the file as chunk(s) and returns the registry jobId', async () => {
  g.__cellSendMessage = async (m) => {
    if (m.type === MESSAGE_TYPES.RESOURCE_LIST) return { success: true, data: { resources: [] } };
    if (m.type === MESSAGE_TYPES.RESOURCE_IMPORT_CHUNK) return { success: true, data: { jobId: 'bg-job-1' } };
    return { success: true, data: {} };
  };
  const file = new File(['{"a":1}'], 'dict.json', { type: 'application/json' });
  await expect(importResourceFile(file, { langCode: 'en' })).resolves.toEqual({ jobId: 'bg-job-1' });
});
