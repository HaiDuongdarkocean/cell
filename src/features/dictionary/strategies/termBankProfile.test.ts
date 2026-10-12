import 'fake-indexeddb/auto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { unzipSync, zipSync } from 'fflate';
import { TermBankStrategy } from '@/features/dictionary/strategies/termBankStrategy';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import { addResource } from '@/features/dictionary/repositories/resourceRepository';

jest.setTimeout(600_000);

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
});

beforeEach(async () => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  closeAllDBs();
  await clearAllStores('en');
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

const ZIP_CANDIDATES = [
  process.env.TERMBANK_PROFILE_ZIP,
  path.resolve(__dirname, '../../../../data/resource/en/dictionary/dict-oald.zip'),
  path.resolve(__dirname, '../../../../../../cell/data/resource/en/dictionary/dict-oald.zip'),
].filter((p): p is string => typeof p === 'string' && p.length > 0);

const zipPath = ZIP_CANDIDATES.find((p) => fs.existsSync(p));
const profileIt = zipPath ? it : it.skip;

const BANK_LIMIT = Number(process.env.TERMBANK_PROFILE_BANKS ?? '2');

function subsetZip(data: Uint8Array, bankLimit: number): Uint8Array {
  if (!Number.isFinite(bankLimit) || bankLimit <= 0) return data;
  const files = unzipSync(data);
  const keep = new Set(['index.json']);
  Object.keys(files)
    .filter((n) => n.includes('term_bank') && !n.includes('term_meta_bank'))
    .sort()
    .slice(0, bankLimit)
    .forEach((n) => keep.add(n));
  const subset: Record<string, Uint8Array> = {};
  for (const n of Object.keys(files)) if (keep.has(n)) subset[n] = files[n]!;
  return zipSync(subset);
}

describe('termBankStrategy — real-zip profile', () => {
  profileIt('reports parse/transform/insert split on the OALD bank', async () => {
    const data = subsetZip(new Uint8Array(fs.readFileSync(zipPath!)), BANK_LIMIT);
    const resourceId = await addResource('en', {
      name: 'dict-oald.zip', langCode: 'en', type: 'DICTIONARY', format: 'term-bank',
      signature: 'sig-prof', wordCount: 0, installationFinished: false, importedAt: Date.now(),
    });
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const wallStart = performance.now();
    try {
      const strategy = new TermBankStrategy(
        { resourceId, langCode: 'en' },
        { data, fileName: 'dict-oald.zip' },
      );
      const result = await strategy.execute();
      const wallMs = performance.now() - wallStart;
      expect(result.wordCount).toBeGreaterThan(0);
      const profileLine = infoSpy.mock.calls
        .map((c) => String(c[0]))
        .find((c) => c.includes('[import] term-bank profile'));
      expect(profileLine).toBeDefined();
      process.stdout.write(
        `\n[profile] file=${zipPath} zipMB=${(data.length / 1048576).toFixed(2)} words=${result.wordCount} wall=${wallMs.toFixed(0)}ms\n${profileLine}\n`,
      );
    } finally {
      infoSpy.mockRestore();
    }
  });
});
