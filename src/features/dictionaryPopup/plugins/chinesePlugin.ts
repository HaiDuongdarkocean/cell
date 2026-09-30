// chinesePlugin — spec §4.6.4: Chinese language plugin.
//
// Dictionary-driven Forward Maximum Matching (FMM) segmentation: scan
// left→right, match the longest dictionary term at each position. No
// external library — pure function with a TermProbe (hasTerm).
//
// Pinyin reading: the plugin does NOT generate pinyin itself — pinyin
// comes from the dictionary entry (CEDICT stores pinyin per term). The
// plugin's readingKind is 'pinyin' so the orchestrator knows to display
// the entry's reading field as pinyin.
//
// Chengyu (成语): 4-character idioms are naturally handled by FMM — if a
// 4-char sequence is in the dictionary, FMM matches it as a single
// segment. No special-casing needed. The plugin exposes a helper
// `isChengyu(term)` for the UI to label chengyu entries.
//
// ponytail: FMM does not handle ambiguity well (研究生命 → 研究生/命
// vs 研究生/命). Ceiling: ambiguity cases. Upgrade path: DAG + word
// frequency score (spec §D-alternatives).

import type {
  LanguagePlugin,
  Token,
  TermProbe,
  Accent,
} from './languagePlugin';
import { segmentFMM } from '@/features/dictionary';

export { isCJK, isCJKString, isChengyu, segmentFMM } from '@/features/dictionary';

/** Chinese accents for audio priority (spec §4.6.4). */
export const CHINESE_ACCENTS: readonly Accent[] = [
  { id: 'pinyin', label: 'Pinyin' },
];

/**
 * Create the Chinese language plugin.
 *
 * The plugin is stateless — the orchestrator provides the TermProbe
 * (dictionary) per segmentation call via plugin.segment(text, dict).
 */
export function createChinesePlugin(): LanguagePlugin {
  return {
    langCode: 'zh',
    readingKind: 'pinyin',
    accents: CHINESE_ACCENTS,
    tokenize(sentence: string): readonly Token[] {
      // For Chinese, tokenize = segment with a trivial probe that matches
      // only single chars. The real segmentation uses plugin.segment
      // with a dictionary-backed TermProbe.
      return segmentFMM(sentence, { hasTerm: () => false });
    },
    segment(text: string, dict: TermProbe): readonly Token[] {
      return segmentFMM(text, dict);
    },
  };
}
