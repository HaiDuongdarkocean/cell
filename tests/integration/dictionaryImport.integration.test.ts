// Dictionary import smoke test — real test resources from tests/data-test/resource.
// Verifies full pipeline: detect → signature → dedupe → strategy → IDB persist.
// Uses fake-indexeddb (no real Chrome needed). Reads real files via fs.

import 'fake-indexeddb/auto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { importFile, listResources, deleteResourceCascade } from '@/features/dictionary/logic/importOrchestrator';
import { countFrequencyByResource } from '@/features/dictionary/repositories/frequencyRepository';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import { DuplicateFileError } from '@/features/dictionary/logic/importErrors';

const RESOURCE_DIR = join(__dirname, '..', '..', 'tests', 'data-test', 'resource', 'en');

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: jest.fn(),
      },
    },
  } as unknown as typeof chrome;
  storageLocalGetMock.mockResolvedValue({});
});

beforeEach(() => {
  closeAllDBs();
});

beforeEach(async () => {
  await clearAllStores('en');
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

const LANG = 'en';

function readResource(relPath: string): { name: string; size: number; data: Uint8Array; slice: (s: number, e: number) => { arrayBuffer(): Promise<ArrayBuffer> } } {
  const fullPath = join(RESOURCE_DIR, relPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Test resource not found: ${fullPath}`);
  }
  const data = new Uint8Array(readFileSync(fullPath));
  return {
    name: relPath.split(/[\\/]/).pop()!,
    size: data.length,
    data,
    slice: (start: number, end: number) => ({
      arrayBuffer: () => Promise.resolve(data.slice(start, end).buffer as ArrayBuffer),
    }),
  };
}

// Override importFile to use pre-read data (avoid re-reading in orchestrator)
async function importFileFromData(
  file: ReturnType<typeof readResource>,
  resourceType: 'FREQUENCY' | 'DICTIONARY',
): Promise<{ resourceId: number; wordCount: number; format: string }> {
  // Patch: orchestrator reads via slice, which we've provided
  return importFile(file, resourceType, { langCode: LANG });
}

describe('dictionary import smoke — real test resources', () => {
  it('imports TXT frequency list (frequency List English.txt)', async () => {
    const file = readResource(join('frequency_list', 'frequency List English.txt'));
    const result = await importFileFromData(file, 'FREQUENCY');
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.format).toBe('txt');
    const count = await countFrequencyByResource(LANG, result.resourceId);
    expect(count).toBe(result.wordCount);
  }, 30000);

  it('imports JSON array frequency list (standard.json)', async () => {
    const file = readResource(join('frequency_list', 'standard.json'));
    const result = await importFileFromData(file, 'FREQUENCY');
    expect(result.wordCount).toBeGreaterThan(0);
    expect(['json-array', 'cambridge-json']).toContain(result.format);
  }, 30000);

  it('imports Yomitan ZIP frequency (oald.zip)', async () => {
    const file = readResource(join('frequency_list', 'oald.zip'));
    const result = await importFileFromData(file, 'FREQUENCY');
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.format).toBe('yomitan');
  }, 30000);

  it('imports Cambridge JSON dictionary (CambridgeV1_0_*.json) — SLOW, 43MB', async () => {
    const camPath = join('dictionary', 'CambridgeV1_0_20260121_1628_20260325_1617.json');
    if (!existsSync(join(RESOURCE_DIR, camPath))) {
      console.warn('Skipping Cambridge smoke — file not found');
      return;
    }
    // 43MB file — give generous timeout
    const file = readResource(camPath);
    const result = await importFileFromData(file, 'DICTIONARY');
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.format).toBe('cambridge-json');
  }, 120000); // 2 min timeout for 43MB

  it('rejects duplicate import (same file twice)', async () => {
    const file = readResource(join('frequency_list', 'frequency List English.txt'));
    await importFileFromData(file, 'FREQUENCY');
    await expect(importFileFromData(file, 'FREQUENCY')).rejects.toThrow(DuplicateFileError);
  }, 30000);

  it('lists resources after multiple imports', async () => {
    const txt = readResource(join('frequency_list', 'frequency List English.txt'));
    const json = readResource(join('frequency_list', 'standard.json'));
    await importFileFromData(txt, 'FREQUENCY');
    await importFileFromData(json, 'FREQUENCY');
    const list = await listResources(LANG);
    expect(list.length).toBe(2);
  }, 60000);

  it('deletes resource + cascades entries (small inline file)', async () => {
    // Use small inline file — delete via cursor on large dataset is slow with fake-indexeddb
    const smallData = new Uint8Array(Buffer.from('hello\nworld\nfoo\nbar\nbaz\n'));
    const file = {
      name: 'small.txt',
      size: smallData.length,
      slice: (s: number, e: number) => ({
        arrayBuffer: () => Promise.resolve(smallData.slice(s, e).buffer as ArrayBuffer),
      }),
    };
    const result = await importFile(file, 'FREQUENCY', { langCode: LANG });
    await deleteResourceCascade(LANG, result.resourceId);
    const list = await listResources(LANG);
    expect(list.find((r) => r.id === result.resourceId)).toBeUndefined();
    expect(await countFrequencyByResource(LANG, result.resourceId)).toBe(0);
  }, 30000);
});
