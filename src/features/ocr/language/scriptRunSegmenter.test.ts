// scriptRunSegmenter tests — spec §AD6, T2.
// Uses fixture: tests/data-test/ocr/fixtures/scriptRunCases.json (15 cases).

import { describe, expect, it } from '@jest/globals';
import { scriptRunSegmenter, type ScriptRun } from './scriptRunSegmenter';
import scriptRunCases from '../../../../tests/data-test/ocr/fixtures/scriptRunCases.json';

describe('scriptRunSegmenter', () => {
  for (const tc of scriptRunCases.cases) {
    it(`case: ${tc.id} — "${tc.input.replace(/\n/g, '\\n')}"`, () => {
      const result = scriptRunSegmenter(tc.input);
      expect(result).toEqual(tc.expected as readonly ScriptRun[]);
    });
  }

  it('returns empty array for empty string', () => {
    expect(scriptRunSegmenter('')).toEqual([]);
  });

  it('classifies Japanese kanji+kana as ja (not zh)', () => {
    const runs = scriptRunSegmenter('日本語を勉強する');
    expect(runs).toHaveLength(1);
    expect(runs[0]!.script).toBe('ja');
  });

  it('classifies pure Chinese as zh', () => {
    const runs = scriptRunSegmenter('我喜欢北京');
    expect(runs).toHaveLength(1);
    expect(runs[0]!.script).toBe('zh');
  });

  it('splits mixed intra-box zh+en', () => {
    const runs = scriptRunSegmenter('我喜欢 watching movies');
    expect(runs).toHaveLength(2);
    expect(runs[0]!.script).toBe('zh');
    expect(runs[1]!.script).toBe('en');
  });

  it('splits mixed ja+en+ja', () => {
    const runs = scriptRunSegmenter('日本語をstudyしています');
    expect(runs).toHaveLength(3);
    expect(runs[0]!.script).toBe('ja');
    expect(runs[1]!.script).toBe('en');
    expect(runs[2]!.script).toBe('ja');
  });
});
