// Strict fixture test — Chinese plugin with real Moedict data (162k CJK terms).
//
// Verifies FMM segmentation on real dictionary data:
// - Common multi-char words segment correctly (我喜欢你 → 我/喜欢/你)
// - Chengyu (4-char idioms) segment as one token when in dict
// - Mixed CJK + punctuation + latin handles correctly
// - Lookup orchestrator end-to-end with real dict entries
//
// MoedictSimplified.json format: [{term, altterm, pronunciation, definition, pos, examples, audio}, ...]
// Same shape as Cambridge JSON — the CambridgeJsonStrategy can import it.

import fs from 'node:fs';
import path from 'node:path';
import 'fake-indexeddb/auto';
import { describe, expect, it, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { segmentFMM, isChengyu } from '../plugins/chinesePlugin';
import type { TermProbe } from '../plugins/languagePlugin';
import { lookupOrchestrator, createDictionaryProbeAsync, clearDictionaryProbeCache } from './lookupOrchestrator';
import { closeAllDBs, clearAllStores } from '@/features/dictionary/repositories/baseRepository';
import { addResource } from '@/features/dictionary/repositories/resourceRepository';
import { addDictionaryEntry } from '@/features/dictionary/repositories/dictionaryRepository';

interface MoedictEntry {
  readonly term: string;
  readonly altterm?: string;
  readonly pronunciation?: string;
  readonly definition?: string;
  readonly pos?: string;
  readonly examples?: string;
  readonly audio?: string;
}

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../../tests/data-test/resource/zh/MoedictSimplified.json',
);

const CJK_RE = /^[\u4e00-\u9fff\u3400-\u4dbf]+$/;

// Load + filter once for all tests in this file.
let allEntries: MoedictEntry[];
let cjkEntries: MoedictEntry[];
let probe: TermProbe;

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

  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as MoedictEntry[];
  allEntries = raw;
  cjkEntries = raw.filter((e) => CJK_RE.test(e.term));
  const termSet = new Set(cjkEntries.map((e) => e.term));
  probe = { hasTerm: (t: string) => termSet.has(t) };
});

beforeEach(() => {
  closeAllDBs();
  clearDictionaryProbeCache(); // T23: clear probe cache between tests.
});

beforeEach(async () => {
  await clearAllStores('zh');
});

afterAll(() => {
  delete (global as { chrome?: unknown }).chrome;
});

/** Seed a subset of Moedict entries into IndexedDB for orchestrator tests. */
async function seedSubset(terms: string[]): Promise<number> {
  const resourceId = await addResource('zh', {
    name: 'MoedictSimplified.json',
    langCode: 'zh',
    type: 'DICTIONARY',
    format: 'cambridge-json',
    signature: `zh-fixture-${Date.now()}`,
    wordCount: terms.length,
    installationFinished: true,
    importedAt: Date.now(),
  });
  const byTerm = new Map(cjkEntries.map((e) => [e.term, e]));
  for (const term of terms) {
    const entry = byTerm.get(term);
    if (!entry) continue;
    await addDictionaryEntry('zh', {
      resourceId,
      term: entry.term,
      reading: entry.pronunciation ?? '',
      altterm: entry.altterm ?? '',
      pronunciation: entry.pronunciation ?? '',
      definition: entry.definition ?? '',
      pos: entry.pos ?? '',
      examples: entry.examples ?? '',
      audio: entry.audio ?? '',
    });
  }
  return resourceId;
}

describe('chinesePlugin fixture — MoedictSimplified (162k CJK terms)', () => {
  describe('fixture shape', () => {
    it('loads and has ≥100k entries', () => {
      expect(allEntries.length).toBeGreaterThan(100_000);
    });

    it('has ≥100k CJK-only terms', () => {
      expect(cjkEntries.length).toBeGreaterThan(100_000);
    });

    it('has ≥30k chengyu (4-char CJK terms)', () => {
      const chengyu = cjkEntries.filter((e) => e.term.length === 4);
      expect(chengyu.length).toBeGreaterThan(30_000);
    });

    it('has multi-char terms (≥2 chars)', () => {
      const multi = cjkEntries.filter((e) => e.term.length >= 2);
      expect(multi.length).toBeGreaterThan(100_000);
    });
  });

  describe('FMM segmentation with real dictionary', () => {
    it('segments 我喜欢你 → 我/喜欢/你', () => {
      const tokens = segmentFMM('我喜欢你', probe);
      expect(tokens.map((t) => t.text)).toEqual(['我', '喜欢', '你']);
    });

    it('segments 他在学习中文 — FMM picks longest match at each position', () => {
      const tokens = segmentFMM('他在学习中文', probe);
      const texts = tokens.map((t) => t.text);
      // FMM scans left→right: at position 1 (在), "在学" (2 chars) is in
      // dict → matches "在学" before "学习". This is the known FMM
      // ambiguity ceiling (spec §D-alternatives). Verify 中文 segments
      // correctly and the result is reasonable.
      expect(texts).toContain('中文');
      expect(texts[0]).toBe('他');
    });

    it('segments chengyu 八面玲珑 as one token', () => {
      const tokens = segmentFMM('八面玲珑', probe);
      const chengyuToken = tokens.find((t) => t.text === '八面玲珑');
      expect(chengyuToken).toBeDefined();
      expect(isChengyu(chengyuToken!.text)).toBe(true);
    });

    it('segments chengyu in context: 画蛇添足的故事 → 画蛇添足/的/故事', () => {
      const tokens = segmentFMM('画蛇添足的故事', probe);
      const texts = tokens.map((t) => t.text);
      expect(texts).toContain('画蛇添足');
      expect(texts).toContain('的');
      expect(texts).toContain('故事');
    });

    it('segments chengyu 守株待兔 as one token', () => {
      const tokens = segmentFMM('守株待兔', probe);
      expect(tokens.some((t) => t.text === '守株待兔')).toBe(true);
    });

    it('segments mixed CJK + punctuation: 我喜欢。 → 我/喜欢/。', () => {
      const tokens = segmentFMM('我喜欢。', probe);
      expect(tokens.map((t) => t.text)).toEqual(['我', '喜欢', '。']);
    });

    it('segments mixed CJK + latin: 学English → 学/English', () => {
      const tokens = segmentFMM('学English', probe);
      const texts = tokens.map((t) => t.text);
      expect(texts).toContain('学');
      expect(texts).toContain('english');
    });

    it('prefers longest match (FMM): 中国人 → 中国人 not 中国/人', () => {
      // If 中国人 is in dict, FMM should match it as one token.
      const tokens = segmentFMM('中国人', probe);
      // Either 中国人 is one token, or 中国 + 人. Both are valid FMM
      // depending on whether 中国人 is in the dict.
      const texts = tokens.map((t) => t.text);
      if (probe.hasTerm('中国人')) {
        expect(texts).toContain('中国人');
      } else {
        expect(texts).toContain('中国');
      }
    });

    it('offsets are character-based', () => {
      const tokens = segmentFMM('我喜欢你', probe);
      // 我 at 0, 喜欢 at 1-2, 你 at 3
      expect(tokens[0]!.start).toBe(0);
      expect(tokens[0]!.end).toBe(1);
      expect(tokens[1]!.start).toBe(1);
      expect(tokens[1]!.end).toBe(3);
      expect(tokens[2]!.start).toBe(3);
      expect(tokens[2]!.end).toBe(4);
    });
  });

  describe('lookupOrchestrator end-to-end with Moedict subset', () => {
    it('looks up 喜欢 from 我喜欢你 with cursor on 喜', async () => {
      await seedSubset(['喜欢', '我', '你']);

      const result = await lookupOrchestrator({
        term: '喜',
        langCode: 'zh',
        contextSentence: '我喜欢你',
        cursorOffset: 1,
      });

      expect(result.term).toBe('喜欢');
      expect(result.matchSource).toBe('plugin');
      expect(result.readingKind).toBe('pinyin');
      expect(result.definitions.length).toBeGreaterThan(0);
    });

    it('looks up 学习 from 他在学习中文 with cursor on 学', async () => {
      await seedSubset(['学习', '中文', '他', '在']);

      const result = await lookupOrchestrator({
        term: '学',
        langCode: 'zh',
        contextSentence: '他在学习中文',
        cursorOffset: 2, // cursor on 学
      });

      expect(result.term).toBe('学习');
      expect(result.matchSource).toBe('plugin');
      expect(result.definitions.length).toBeGreaterThan(0);
    });

    it('looks up chengyu 八面玲珑', async () => {
      await seedSubset(['八面玲珑']);

      const result = await lookupOrchestrator({
        term: '八',
        langCode: 'zh',
        contextSentence: '八面玲珑',
        cursorOffset: 0,
      });

      expect(result.term).toBe('八面玲珑');
      expect(result.matchSource).toBe('plugin');
      expect(isChengyu(result.term)).toBe(true);
    });

    it('returns pinyin reading from dictionary entry', async () => {
      await seedSubset(['中国']);

      const result = await lookupOrchestrator({
        term: '中',
        langCode: 'zh',
        contextSentence: '中国很大',
        cursorOffset: 0,
      });

      expect(result.term).toBe('中国');
      expect(result.reading).toBeTruthy();
      expect(result.readingKind).toBe('pinyin');
    });
  });

  describe('createDictionaryProbeAsync with real data', () => {
    it('creates a probe from seeded IndexedDB entries', async () => {
      await seedSubset(['喜欢', '中国', '学习']);
      const realProbe = await createDictionaryProbeAsync('zh');
      expect(realProbe.hasTerm('喜欢')).toBe(true);
      expect(realProbe.hasTerm('中国')).toBe(true);
      expect(realProbe.hasTerm('学习')).toBe(true);
      expect(realProbe.hasTerm('不存在的词')).toBe(false);
    });
  });
});
