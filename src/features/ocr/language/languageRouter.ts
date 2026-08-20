// languageRouter — T15. Routes script-runs to language plugin codes.
// spec §AD6: zh → chinesePlugin, en → englishPlugin, ja/ko → fallback single-char,
// unknown → englishPlugin (numbers/punctuation default to English).

import type { ScriptRun, Script } from './scriptRunSegmenter';

/** Language plugin code matching existing dictionary plugins. */
export type LangCode = 'zh' | 'en' | 'ja';

/** Route a single script to a language plugin code. */
export function routeScript(script: Script): LangCode {
  switch (script) {
    case 'zh': return 'zh';
    case 'en': return 'en';
    case 'ja': return 'ja'; // fallback single-char (no japanesePlugin yet)
    case 'ko': return 'zh'; // ko fallback → zh (CJK shared)
    case 'unknown': return 'en'; // numbers/punctuation → English
    default: return 'en';
  }
}

/** Routed script-run: original text + resolved langCode. */
export interface RoutedRun {
  readonly text: string;
  readonly script: Script;
  readonly langCode: LangCode;
}

/** Route all script-runs to langCode. Preserves text + script for debugging. */
export function routeScriptRuns(runs: readonly ScriptRun[]): readonly RoutedRun[] {
  return runs.map(run => ({ text: run.text, script: run.script, langCode: routeScript(run.script) }));
}
