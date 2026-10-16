import 'fake-indexeddb/auto';
import * as path from 'path';
import * as fs from 'fs';
import { importFile } from './logic/importOrchestrator';
import { findDictionaryEntry } from './repositories/resourceEntryRepository';
import { findFrequencyEntry } from './repositories/resourceEntryRepository';
import { getAllResources } from './repositories/resourceRepository';
import { closeAllDBs, clearAllStores } from './repositories/baseRepository';
import type { ReadableFile } from './logic/fileDetector';

// Real sql.js wasm (not the unit-test mock) — force the node build
// (browser build needs fetch) and point locateFile at node_modules dist.
jest.mock('sql.js', () => {
  const real = jest.requireActual('sql.js/dist/sql-wasm.js');
  return {
    __esModule: true,
    default: (config?: { locateFile?: (f: string) => string }) =>
      real({
        ...(config ?? {}),
        locateFile: (f: string) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
      }),
  };
});

const FIXTURES = path.join(process.cwd(), 'tests', 'data-test', 'migaku');

function fileOf(name: string): ReadableFile {
  const bytes = new Uint8Array(fs.readFileSync(path.join(FIXTURES, name)));
  return {
    size: bytes.length,
    name,
    slice: (s: number, e: number) => ({
      arrayBuffer: async () => bytes.slice(s, e).buffer as ArrayBuffer,
    }),
  };
}

beforeEach(async () => {
  for (const lang of ['pt', 'vi', 'ja', 'yue', 'ar']) await clearAllStores(lang);
}, 180000);
afterEach(() => closeAllDBs());

describe('Migaku real fixtures → importFile', () => {
  it('dictionary .db.gz (pt→es Wiktionary)', async () => {
    const res = await importFile(fileOf('pt-es-wiktionary.db.gz'), { langCode: 'pt' });
    expect(res.format).toBe('sqlite');
    expect(res.wordCount).toBe(7426);
    const entry = await findDictionaryEntry('pt', res.resourceId, 'katakana');
    expect(entry?.definition).toContain('Katakana');
  }, 180000);

  it('frequency .db.gz (vi OpenSubtitle)', async () => {
    const res = await importFile(fileOf('OpenSubtitle.db.gz'), { langCode: 'vi' });
    expect(res.format).toBe('sqlite');
    expect(res.wordCount).toBe(12087);
    const entry = await findFrequencyEntry('vi', res.resourceId, 'tôi');
    expect(entry?.frequency).toBe(1);
  }, 180000);

  it('frequency .json array-of-strings (vi OpenSubtitle)', async () => {
    const res = await importFile(fileOf('OpenSubtitle.json'), { langCode: 'vi' });
    expect(res.format).toBe('json-array');
    expect(res.wordCount).toBeGreaterThan(10000);
    const entry = await findFrequencyEntry('vi', res.resourceId, 'tôi');
    expect(entry?.frequency).toBe(1);
  }, 180000);

  it('dictionary .zip single-JSON (pt→es Wiktionary)', async () => {
    const res = await importFile(fileOf('pt-es-wiktionary.zip'), { langCode: 'pt' });
    expect(res.wordCount).toBeGreaterThan(7000);
    const entry = await findDictionaryEntry('pt', res.resourceId, 'katakana');
    expect(entry?.definition).toContain('Katakana');
  }, 180000);

  it('word list .json (JLPT tag list)', async () => {
    const res = await importFile(fileOf('JLPT.json'), { langCode: 'ja' });
    expect(res.wordCount).toBeGreaterThan(1000);
    const entry = await findDictionaryEntry('ja', res.resourceId, '道');
    expect(entry?.definition).toContain('N5');
  }, 180000);

  it('frequency url_zip (zipped json-array, yue)', async () => {
    const res = await importFile(fileOf('Scotts_from_Reddit.json.zip'), { langCode: 'yue' });
    expect(res.format).toBe('json-array');
    expect(res.wordCount).toBeGreaterThan(1000);
    const entry = await findFrequencyEntry('yue', res.resourceId, '我');
    expect(entry?.frequency).toBe(1);
  }, 180000);

  it('dictionary .zip >1MB — head sniff fails, full-data re-sniff (ar Vicon)', async () => {
    const res = await importFile(fileOf('ar-vicon.zip'), { langCode: 'ar' });
    expect(res.format).toBe('json-entries');
    expect(res.wordCount).toBeGreaterThan(50000);
    const entry = await findDictionaryEntry('ar', res.resourceId, 'آب');
    expect(entry?.definition).toContain('August');
  }, 240000);

  it('re-download of the same dict is deduped by signature', async () => {
    const first = await importFile(fileOf('pt-es-wiktionary.db.gz'), { langCode: 'pt' });
    const second = await importFile(fileOf('pt-es-wiktionary.db.gz'), { langCode: 'pt' });
    expect(second.skippedAsDuplicate).toBe(true);
    expect(second.resourceId).toBe(first.resourceId);
    expect(await getAllResources('pt')).toHaveLength(1);
  }, 120000);
});
