// languageRouter tests — T15.

import { describe, expect, it } from '@jest/globals';
import { routeScript, routeScriptRuns } from './languageRouter';
import { scriptRunSegmenter } from './scriptRunSegmenter';

describe('languageRouter (T15)', () => {
  describe('routeScript', () => {
    it('zh → zh', () => expect(routeScript('zh')).toBe('zh'));
    it('en → en', () => expect(routeScript('en')).toBe('en'));
    it('ja → ja (fallback single-char)', () => expect(routeScript('ja')).toBe('ja'));
    it('ko → zh (CJK fallback)', () => expect(routeScript('ko')).toBe('zh'));
    it('unknown → en', () => expect(routeScript('unknown')).toBe('en'));
  });

  describe('routeScriptRuns', () => {
    it('routes "我喜欢" → zh', () => {
      const runs = scriptRunSegmenter('我喜欢');
      const routed = routeScriptRuns(runs);
      expect(routed).toHaveLength(1);
      expect(routed[0]!.langCode).toBe('zh');
    });

    it('routes "Hello" → en', () => {
      const runs = scriptRunSegmenter('Hello');
      const routed = routeScriptRuns(runs);
      expect(routed).toHaveLength(1);
      expect(routed[0]!.langCode).toBe('en');
    });

    it('routes "日本語を" → ja (kana triggers ja classification)', () => {
      const runs = scriptRunSegmenter('日本語を');
      const routed = routeScriptRuns(runs);
      expect(routed).toHaveLength(1);
      expect(routed[0]!.langCode).toBe('ja');
    });

    it('routes "안녕" → zh (ko fallback)', () => {
      const runs = scriptRunSegmenter('안녕');
      const routed = routeScriptRuns(runs);
      expect(routed).toHaveLength(1);
      expect(routed[0]!.langCode).toBe('zh');
    });

    it('routes "123!" → en (unknown→en)', () => {
      const runs = scriptRunSegmenter('123!');
      const routed = routeScriptRuns(runs);
      expect(routed.at(-1)!.langCode).toBe('en');
    });

    it('routes mixed "我喜欢 watching" → [zh, en]', () => {
      const runs = scriptRunSegmenter('我喜欢 watching');
      const routed = routeScriptRuns(runs);
      expect(routed).toHaveLength(2);
      expect(routed[0]!.langCode).toBe('zh');
      expect(routed[1]!.langCode).toBe('en');
    });

    it('routes mixed "日本語をstudy" → [ja, en]', () => {
      const runs = scriptRunSegmenter('日本語をstudy');
      const routed = routeScriptRuns(runs);
      const langCodes = routed.map(r => r.langCode);
      expect(langCodes).toContain('ja');
      expect(langCodes).toContain('en');
    });

    it('preserves text + script in routed output', () => {
      const runs = scriptRunSegmenter('我喜欢');
      const routed = routeScriptRuns(runs);
      expect(routed[0]!.text).toBe('我喜欢');
      expect(routed[0]!.script).toBe('zh');
    });
  });
});
