import type { BilingualCue } from '@/entities/media';
import type { TokenFrequencyBand, CueListTokenMap } from '@/features/tokenize';

export interface PrimerRow {
  readonly term: string;
  readonly status: 'unknown' | 'tracking';
  readonly count: number;
  readonly rank: number | null;
  readonly band: TokenFrequencyBand;
  readonly contextText: string;
  readonly firstCueIndex: number;
  readonly firstCueStartMs: number;
  readonly firstCueEndMs: number;
  readonly firstTokenOffset: number;
}

interface PrimerRowDraft {
  term: string;
  status: 'unknown' | 'tracking';
  count: number;
  band: TokenFrequencyBand;
  contextText: string;
  firstCueIndex: number;
  firstCueStartMs: number;
  firstCueEndMs: number;
  firstTokenOffset: number;
}

export function buildPrimerList(
  tokenMap: CueListTokenMap,
  rankByTerm: ReadonlyMap<string, number | null>,
  cues: readonly BilingualCue[],
): PrimerRow[] {
  const cueByIndex = new Map<number, BilingualCue>();
  for (const cue of cues) cueByIndex.set(cue.index, cue);

  const drafts = new Map<string, PrimerRowDraft>();
  for (const [cueIndex, tokens] of tokenMap) {
    const cue = cueByIndex.get(cueIndex);
    if (!cue) continue;
    for (const token of tokens) {
      if (token.isSeparator) continue;
      if (token.status !== 'unknown' && token.status !== 'tracking') continue;
      const existing = drafts.get(token.term);
      if (existing) {
        existing.count++;
        continue;
      }
      drafts.set(token.term, {
        term: token.term,
        status: token.status,
        count: 1,
        band: token.frequencyBand ?? 'none',
        contextText: cue.targetText,
        firstCueIndex: cue.index,
        firstCueStartMs: cue.start,
        firstCueEndMs: cue.end,
        firstTokenOffset: token.start,
      });
    }
  }

  return [...drafts.values()]
    .map((draft) => ({
      ...draft,
      rank: rankByTerm.get(draft.term) ?? null,
    }))
    .sort((a, b) => {
      const rankA = a.rank ?? Number.POSITIVE_INFINITY;
      const rankB = b.rank ?? Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      if (a.count !== b.count) return b.count - a.count;
      return a.term < b.term ? -1 : a.term > b.term ? 1 : 0;
    });
}
