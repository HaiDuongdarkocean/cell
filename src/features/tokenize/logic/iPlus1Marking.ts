import type { Token } from '@/features/tokenize/types';
import { isNotKnown } from '@/features/dictionary';
import { isScorableToken } from './comprehensionScore';

export const IPLUS1_OFF_CLASS = 'js-Tihoka-token--i1-off';
export const IPLUS1_MIN_SCORABLE = 3;
const NUMERIC_RE = /^\p{N}+$/u;

export interface IPlus1Word {
  readonly term: string;
  readonly isNew: boolean;
}

export function pickIPlus1Index(words: readonly IPlus1Word[]): number | null {
  let scorable = 0;
  let newCount = 0;
  let newIndex = -1;
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (NUMERIC_RE.test(word.term)) continue;
    scorable++;
    if (word.isNew) {
      newCount++;
      newIndex = i;
    }
  }
  return scorable >= IPLUS1_MIN_SCORABLE && newCount === 1 ? newIndex : null;
}

export function markedTokenIndexes(tokens: readonly Token[]): ReadonlySet<number> {
  const groups = new Map<number, { indexes: number[]; words: IPlus1Word[] }>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!isScorableToken(token)) continue;
    let group = groups.get(token.sentenceIndex);
    if (!group) {
      group = { indexes: [], words: [] };
      groups.set(token.sentenceIndex, group);
    }
    group.indexes.push(i);
    group.words.push({ term: token.term, isNew: isNotKnown(token.status ?? 'unknown') });
  }
  const marked = new Set<number>();
  for (const group of groups.values()) {
    const picked = pickIPlus1Index(group.words);
    if (picked !== null) marked.add(group.indexes[picked]!);
  }
  return marked;
}
