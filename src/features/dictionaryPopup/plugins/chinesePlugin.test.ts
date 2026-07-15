// chinesePlugin tests — spec §4.6.4: FMM segmentation + pinyin + chengyu.

import { describe, expect, it } from '@jest/globals';
import {
  createChinesePlugin,
  segmentFMM,
  isCJK,
  isCJKString,
  isChengyu,
  CHINESE_ACCENTS,
} from './chinesePlugin';
import type { TermProbe } from './languagePlugin';

/** Build a TermProbe from a set of known terms. */
function probe(terms: string[]): TermProbe {
  const set = new Set(terms);
  return { hasTerm: (t: string) => set.has(t) };
}

describe('chinesePlugin', () => {
  describe('metadata', () => {
    it('has langCode zh and readingKind pinyin', () => {
      const plugin = createChinesePlugin();
      expect(plugin.langCode).toBe('zh');
      expect(plugin.readingKind).toBe('pinyin');
    });

    it('has pinyin accent', () => {
      expect(CHINESE_ACCENTS).toHaveLength(1);
      expect(CHINESE_ACCENTS[0]!.id).toBe('pinyin');
    });

    it('does not implement lemma/normalizePossessive/matchPhrase', () => {
      const plugin = createChinesePlugin();
      expect(plugin.lemma).toBeUndefined();
      expect(plugin.normalizePossessive).toBeUndefined();
      expect(plugin.matchPhrase).toBeUndefined();
    });
  });

  describe('isCJK / isCJKString', () => {
    it('identifies CJK characters', () => {
      expect(isCJK('我')).toBe(true);
      expect(isCJK('喜')).toBe(true);
      expect(isCJK('a')).toBe(false);
      expect(isCJK(' ')).toBe(false);
      expect(isCJK('。')).toBe(false);
    });

    it('identifies CJK strings', () => {
      expect(isCJKString('我喜欢你')).toBe(true);
      expect(isCJKString('我爱')).toBe(true);
      expect(isCJKString('hello')).toBe(false);
      expect(isCJKString('我a')).toBe(false);
      expect(isCJKString('')).toBe(false);
    });
  });

  describe('isChengyu', () => {
    it('identifies 4-char CJK idioms', () => {
      expect(isChengyu('画蛇添足')).toBe(true);
      expect(isChengyu('守株待兔')).toBe(true);
    });

    it('rejects non-4-char terms', () => {
      expect(isChengyu('我喜欢')).toBe(false);
      expect(isChengyu('我喜欢你')).toBe(true); // 4 CJK chars
      expect(isChengyu('画蛇添足画')).toBe(false); // 5 chars
    });

    it('rejects non-CJK 4-char strings', () => {
      expect(isChengyu('abcd')).toBe(false);
      expect(isChengyu('1234')).toBe(false);
    });
  });

  describe('segmentFMM', () => {
    it('segments 我喜欢你 → 我/喜欢/你 when 喜欢 is in dict', () => {
      const dict = probe(['喜欢', '你', '我']);
      const tokens = segmentFMM('我喜欢你', dict);
      expect(tokens.map((t) => t.text)).toEqual(['我', '喜欢', '你']);
      expect(tokens[0]!.start).toBe(0);
      expect(tokens[0]!.end).toBe(1);
      expect(tokens[1]!.start).toBe(1);
      expect(tokens[1]!.end).toBe(3);
      expect(tokens[2]!.start).toBe(3);
      expect(tokens[2]!.end).toBe(4);
    });

    it('emits single chars when no multi-char term in dict', () => {
      const dict = probe([]);
      const tokens = segmentFMM('我喜欢你', dict);
      expect(tokens.map((t) => t.text)).toEqual(['我', '喜', '欢', '你']);
    });

    it('prefers longest match (FMM)', () => {
      // If both '研究' and '研究生' are in dict, FMM picks '研究生'.
      const dict = probe(['研究', '研究生', '生命']);
      const tokens = segmentFMM('研究生', dict);
      expect(tokens.map((t) => t.text)).toEqual(['研究生']);
    });

    it('handles mixed CJK + punctuation + latin', () => {
      const dict = probe(['喜欢']);
      const tokens = segmentFMM('我喜欢。hello', dict);
      expect(tokens.map((t) => t.text)).toEqual(['我', '喜欢', '。', 'hello']);
    });

    it('handles empty string', () => {
      const dict = probe(['喜欢']);
      expect(segmentFMM('', dict)).toEqual([]);
    });

    it('handles single CJK char', () => {
      const dict = probe([]);
      const tokens = segmentFMM('我', dict);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.text).toBe('我');
    });

    it('chengyu (4-char idiom) is segmented as one token when in dict', () => {
      const dict = probe(['画蛇添足']);
      const tokens = segmentFMM('画蛇添足', dict);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.text).toBe('画蛇添足');
      expect(isChengyu(tokens[0]!.text)).toBe(true);
    });

    it('chengyu falls back to single chars when not in dict', () => {
      const dict = probe([]);
      const tokens = segmentFMM('画蛇添足', dict);
      expect(tokens).toHaveLength(4);
      expect(tokens.map((t) => t.text)).toEqual(['画', '蛇', '添', '足']);
    });

    it('offsets are character-based (not byte-based)', () => {
      const dict = probe(['喜欢']);
      const tokens = segmentFMM('我喜欢你', dict);
      // Each CJK char is 1 position in the chars array.
      expect(tokens[1]!.start).toBe(1);
      expect(tokens[1]!.end).toBe(3);
    });
  });

  describe('createChinesePlugin — segment via plugin', () => {
    it('plugin.segment delegates to segmentFMM', () => {
      const plugin = createChinesePlugin();
      const dict = probe(['喜欢']);
      const tokens = plugin.segment!('我喜欢你', dict);
      expect(tokens.map((t) => t.text)).toEqual(['我', '喜欢', '你']);
    });

    it('plugin.tokenize segments with empty dict (single chars)', () => {
      const plugin = createChinesePlugin();
      const tokens = plugin.tokenize('我喜欢你');
      expect(tokens.map((t) => t.text)).toEqual(['我', '喜', '欢', '你']);
    });
  });
});
