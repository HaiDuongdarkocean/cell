import type { BilingualCue } from '@/entities/media';

export type SubtitlePracticeMode = 'off' | 'dictation' | 'cloze';
export type PracticeTokenState = 'correct' | 'incorrect' | 'missing' | 'extra';

export interface PracticeTokenFeedback {
  readonly text: string;
  readonly expected?: string;
  readonly state: PracticeTokenState;
}

export interface PracticeResult {
  readonly correct: boolean;
  readonly correctCount: number;
  readonly totalCount: number;
  readonly score: number;
  readonly feedback: readonly PracticeTokenFeedback[];
}

export interface WordProgress {
  readonly text: string;
  readonly typed: string;
  readonly state: 'pending' | 'active' | 'completed';
  readonly visibleChars: readonly { readonly char: string; readonly state: PracticeTokenState }[] | null;
  readonly hiddenTailLength: number;
}

export interface DictationProgress {
  readonly words: readonly WordProgress[];
  readonly currentIndex: number;
}

export interface ClozeTextPart {
  readonly type: 'text';
  readonly text: string;
}

export interface ClozeBlankPart {
  readonly type: 'blank';
  readonly id: string;
  readonly answer: string;
  readonly start: number;
  readonly end: number;
}

export type ClozePart = ClozeTextPart | ClozeBlankPart;

export interface ClozeExercise {
  readonly parts: readonly ClozePart[];
  readonly blanks: readonly ClozeBlankPart[];
}

const NORMALIZE_APOSTROPHE_REGEX = /[‘’‛ʼ′＇]/gu;
const NORMALIZE_DASH_REGEX = /[‐‑‒–—―−﹘﹣－]/gu;
const TOKEN_REGEX = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;
const SOURCE_TOKEN_REGEX = /[\p{L}\p{N}]+(?:['‘’‛ʼ′＇‐‑‒–—―−﹘﹣－-][\p{L}\p{N}]+)*/gu;

const CLOZE_RATIO = 0.3;
const CLOZE_MAX_BLANKS = 6;

function normalizeForTokens(value: string): string {
  return value
    .normalize('NFKC')
    .replace(NORMALIZE_APOSTROPHE_REGEX, "'")
    .replace(NORMALIZE_DASH_REGEX, '-')
    .toLocaleLowerCase();
}

export const normalizePracticeToken = (value: string): string =>
  tokenizePracticeText(value).join(' ');

export const tokenizePracticeText = (value: string): readonly string[] =>
  normalizeForTokens(value).match(TOKEN_REGEX) ?? [];

export const evaluateDictation = (expected: string, actual: string): PracticeResult => {
  const expectedTokens = tokenizePracticeText(expected);
  const actualTokens = tokenizePracticeText(actual);
  const length = Math.max(expectedTokens.length, actualTokens.length);
  const feedback: PracticeTokenFeedback[] = [];
  let correctCount = 0;
  for (let i = 0; i < length; i += 1) {
    const exp = expectedTokens[i];
    const act = actualTokens[i];
    if (exp !== undefined && act !== undefined && exp === act) {
      correctCount += 1;
      feedback.push({ text: act, state: 'correct' });
    } else if (exp !== undefined && act !== undefined) {
      feedback.push({ text: act, expected: exp, state: 'incorrect' });
    } else if (exp !== undefined) {
      feedback.push({ text: exp, expected: exp, state: 'missing' });
    } else {
      feedback.push({ text: act ?? '', state: 'extra' });
    }
  }
  const correct = correctCount === expectedTokens.length && actualTokens.length === expectedTokens.length;
  return {
    correct,
    correctCount,
    totalCount: expectedTokens.length,
    score: expectedTokens.length === 0 && actualTokens.length === 0
      ? 100
      : Math.round((correctCount / Math.max(expectedTokens.length, 1)) * 100),
    feedback,
  };
};

interface TokenSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export const buildDictationProgress = (expected: string, actual: string): DictationProgress => {
  const spans = collectTokenSpans(expected);
  const typedTokens = tokenizePracticeText(actual);
  const currentIndex = actual.trim().length === 0 ? 0 : actual.endsWith(' ') ? typedTokens.length : typedTokens.length - 1;
  const clampedCurrent = Math.min(currentIndex, spans.length);
  const words: WordProgress[] = [];
  for (let i = 0; i < spans.length; i += 1) {
    const span = spans[i];
    const typed = typedTokens[i] ?? '';
    const expectedNormalized = normalizeForTokens(span.text);
    const state = i < clampedCurrent ? 'completed' : i === clampedCurrent ? 'active' : 'pending';
    const visibleChars: { char: string; state: PracticeTokenState }[] = [];
    let hiddenTailLength = 0;
    if (state === 'pending') {
      hiddenTailLength = expectedNormalized.length;
    } else if (state === 'active' && typed.length === 0) {
      hiddenTailLength = expectedNormalized.length;
    } else {
      const showFull = state === 'completed';
      const visibleCount = showFull ? expectedNormalized.length : Math.min(typed.length, expectedNormalized.length);
      for (let j = 0; j < visibleCount; j += 1) {
        const displayChar = span.text[j] ?? expectedNormalized[j];
        if (j < typed.length && typed[j] === expectedNormalized[j]) {
          visibleChars.push({ char: displayChar, state: 'correct' });
        } else if (j < typed.length) {
          visibleChars.push({ char: displayChar, state: 'incorrect' });
        } else {
          visibleChars.push({ char: displayChar, state: 'missing' });
        }
      }
      hiddenTailLength = expectedNormalized.length - visibleCount;
    }
    words.push({
      text: span.text,
      typed,
      state,
      visibleChars: visibleChars.length > 0 ? visibleChars : null,
      hiddenTailLength,
    });
  }
  return { words, currentIndex: clampedCurrent };
};

function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function collectTokenSpans(text: string): TokenSpan[] {
  const spans: TokenSpan[] = [];
  for (const match of text.matchAll(SOURCE_TOKEN_REGEX)) {
    const start = match.index ?? 0;
    spans.push({ start, end: start + match[0].length, text: match[0] });
  }
  return spans;
}

export const createClozeExercise = (
  cue: Pick<BilingualCue, 'index' | 'start' | 'targetText'>,
): ClozeExercise => {
  const spans = collectTokenSpans(cue.targetText);
  const n = spans.length;
  const blankCount = n === 0 ? 0 : Math.min(CLOZE_MAX_BLANKS, Math.max(1, Math.round(n * CLOZE_RATIO)));
  if (blankCount === 0) {
    return { parts: [{ type: 'text', text: cue.targetText }], blanks: [] };
  }
  let state = hashSeed(`${cue.index}:${cue.start}:${cue.targetText}`);
  const chosen: number[] = [];
  for (let i = 0; i < blankCount; i += 1) {
    const lo = Math.floor((i * n) / blankCount);
    const hi = Math.floor(((i + 1) * n) / blankCount);
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    chosen.push(lo + (state % Math.max(hi - lo, 1)));
  }
  const parts: ClozePart[] = [];
  const blanks: ClozeBlankPart[] = [];
  let cursor = 0;
  for (const tokenIndex of chosen) {
    const span = spans[tokenIndex];
    if (span.start > cursor) {
      parts.push({ type: 'text', text: cue.targetText.slice(cursor, span.start) });
    }
    const blank: ClozeBlankPart = {
      type: 'blank',
      id: `${cue.index}:${cue.start}:${tokenIndex}`,
      answer: span.text,
      start: span.start,
      end: span.end,
    };
    parts.push(blank);
    blanks.push(blank);
    cursor = span.end;
  }
  if (cursor < cue.targetText.length) {
    parts.push({ type: 'text', text: cue.targetText.slice(cursor) });
  }
  return { parts, blanks };
};

export const evaluateCloze = (
  exercise: ClozeExercise,
  answers: Readonly<Record<string, string>>,
): PracticeResult => {
  const feedback: PracticeTokenFeedback[] = [];
  let correctCount = 0;
  for (const blank of exercise.blanks) {
    const raw = answers[blank.id] ?? '';
    const normalized = normalizePracticeToken(raw);
    if (normalized.length === 0) {
      feedback.push({ text: raw.trim(), expected: blank.answer, state: 'missing' });
    } else if (normalized === normalizePracticeToken(blank.answer)) {
      correctCount += 1;
      feedback.push({ text: blank.answer, state: 'correct' });
    } else {
      feedback.push({ text: raw.trim(), expected: blank.answer, state: 'incorrect' });
    }
  }
  const total = exercise.blanks.length;
  return {
    correct: correctCount === total && total > 0,
    correctCount,
    totalCount: total,
    score: Math.round((correctCount / Math.max(total, 1)) * 100),
    feedback,
  };
};
