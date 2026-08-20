// scriptRunSegmenter — spec §AD6. Splits text into script-runs for per-token language routing.
// SSOT upgrade of detectLangCode: CJK ideographs are zh by default, ja if kana in same phrase.
// Whitespace attaches to previous run (trailing). O(n) single pass + one CJK phrase scan.

/** Script identifier for a text run. */
export type Script = 'zh' | 'en' | 'ja' | 'ko' | 'unknown';

/** A contiguous run of text classified as one script. */
export interface ScriptRun {
  readonly text: string;
  readonly script: Script;
}

const RE_HIRAGANA = /[\u3040-\u309f]/;
const RE_KATAKANA = /[\u30a0-\u30ff]/;
const RE_HANGUL = /[\uac00-\ud7af\u1100-\u11ff]/;
const RE_CJK_IDEOGRAPH = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const RE_LATIN = /[a-zA-Z]/;
const RE_WHITESPACE = /\s/;

/** Classify a single char without CJK phrase context. */
function classifyCharSimple(ch: string): Script {
  if (RE_HIRAGANA.test(ch) || RE_KATAKANA.test(ch)) return 'ja';
  if (RE_HANGUL.test(ch)) return 'ko';
  if (RE_CJK_IDEOGRAPH.test(ch)) return 'zh';
  if (RE_LATIN.test(ch)) return 'en';
  return 'unknown';
}

/** Check if char is CJK-ish (ideograph, kana, or hangul) — part of a CJK phrase. */
function isCJKish(script: Script): boolean {
  return script === 'zh' || script === 'ja' || script === 'ko';
}

/**
 * Split text into script-runs. CJK ideographs in a phrase containing kana → 'ja',
 * containing hangul (no kana) → 'ko', else → 'zh'. Whitespace attaches to previous run.
 */
export function scriptRunSegmenter(text: string): readonly ScriptRun[] {
  if (!text) return [];

  const chars = [...text];
  const charScripts: Script[] = chars.map(classifyCharSimple);

  // Pass 1: Fix zh→ja/ko within CJK phrases (consecutive zh+ja+ko chars).
  // If phrase contains kana → all zh become ja. If hangul (no kana) → zh become ko.
  for (let i = 0; i < chars.length; ) {
    if (!isCJKish(charScripts[i]!)) { i++; continue; }
    let j = i;
    let hasJa = false;
    let hasKo = false;
    while (j < chars.length && isCJKish(charScripts[j]!)) {
      if (charScripts[j] === 'ja') hasJa = true;
      if (charScripts[j] === 'ko') hasKo = true;
      j++;
    }
    if (hasJa) {
      for (let k = i; k < j; k++) if (charScripts[k] === 'zh') charScripts[k] = 'ja';
    } else if (hasKo) {
      for (let k = i; k < j; k++) if (charScripts[k] === 'zh') charScripts[k] = 'ko';
    }
    i = j;
  }

  // Pass 2: Group into runs. Whitespace attaches to previous run (trailing).
  // If no previous run exists, whitespace starts as 'unknown' (leading or all-ws).
  const runs: ScriptRun[] = [];
  let currentText = '';
  let currentScript: Script | null = null;

  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k]!;
    const script = charScripts[k]!;

    if (RE_WHITESPACE.test(ch)) {
      if (currentText) {
        currentText += ch;
      } else {
        currentText = ch;
        currentScript = 'unknown';
      }
    } else {
      if (currentScript === script) {
        currentText += ch;
      } else {
        if (currentText) runs.push({ text: currentText, script: currentScript! });
        currentText = ch;
        currentScript = script;
      }
    }
  }

  if (currentText) runs.push({ text: currentText, script: currentScript! });
  return runs;
}
