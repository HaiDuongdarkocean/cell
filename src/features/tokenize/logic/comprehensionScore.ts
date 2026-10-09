import type { WordStatus } from '@/entities/dictionary';
import type { ComprehensionBand, ComprehensionKind, ComprehensionStats } from '@/entities/comprehension';
import { hasSentenceEnd } from '@/shared/lib/sentencePunct';
import type { Token, TokenBlock } from '@/features/tokenize/types';

const TRACKING_WEIGHT = 0.5;
const NUMERIC_RE = /^\p{N}+$/u;

export const COMPREHENSION_BAND_MIN: Record<
  ComprehensionKind,
  { comfortable: number; stretch: number }
> = {
  media: { comfortable: 95, stretch: 90 },
  text: { comfortable: 98, stretch: 95 },
};

export function bandForCoverage(coverage: number, kind: ComprehensionKind): ComprehensionBand {
  const t = COMPREHENSION_BAND_MIN[kind];
  if (coverage >= t.comfortable) return 'comfortable';
  if (coverage >= t.stretch) return 'stretch';
  return 'hard';
}

function isNew(status: WordStatus | undefined): boolean {
  return status !== 'known' && status !== 'ignore';
}

export function isScorableToken(token: Token): boolean {
  return !token.isSeparator && !NUMERIC_RE.test(token.term);
}

/** Mark the i+1 gap of every sentence: a sentence with exactly one still-new
 *  word is comprehensible apart from that word, so only that token carries
 *  the frequency pill and status capsule. Tokens of sentences with zero or
 *  two-plus gaps stay unmarked and render as plain text. */
export function markIPlus1Tokens(tokens: readonly Token[]): void {
  const gapsBySentence = new Map<number, number>();
  for (const token of tokens) {
    if (!isScorableToken(token) || !isNew(token.status)) continue;
    gapsBySentence.set(token.sentenceIndex, (gapsBySentence.get(token.sentenceIndex) ?? 0) + 1);
  }
  for (const token of tokens) {
    token.iPlus1 =
      isScorableToken(token) && isNew(token.status) && gapsBySentence.get(token.sentenceIndex) === 1;
  }
}

/** Mark the i+1 gaps of a visual sentence that spans several blocks: inline
 *  elements (links, code, emphasis) split one rendered sentence into multiple
 *  text nodes, so per-block marking would score each fragment as its own
 *  sentence and paint an i+1 pill on every one-word fragment. `blocks` must
 *  share one sentence scope, be in document order, and all carry prepared
 *  tokens (unprepared blocks hide their gaps and would over-mark).
 *
 *  Sentence continuity across a block seam: the sentence closes only when a
 *  terminator sits in the text between the last word of a block and the first
 *  word of the next — blocks with no scorable token contribute their whole
 *  text to that gap so a standalone "." node still ends the sentence. */
export function markIPlus1TokensAcrossBlocks(blocks: readonly TokenBlock[]): void {
  const gapsBySentence = new Map<number, number>();
  const assigned: Array<[Token, number]> = [];
  let sentenceId = -1;
  let interTokenText = '';
  for (const block of blocks) {
    const text = block.originalText;
    const scorables = (block.tokens ?? [])
      .filter(isScorableToken)
      .sort((a, b) => a.start - b.start);
    if (scorables.length === 0) {
      interTokenText += text;
      continue;
    }
    if (sentenceId < 0 || hasSentenceEnd(interTokenText + text.slice(0, scorables[0]!.start))) {
      sentenceId++;
    }
    for (let i = 0; i < scorables.length; i++) {
      const token = scorables[i]!;
      if (i > 0) {
        sentenceId += Math.max(0, token.sentenceIndex - scorables[i - 1]!.sentenceIndex);
      }
      assigned.push([token, sentenceId]);
      if (isNew(token.status)) {
        gapsBySentence.set(sentenceId, (gapsBySentence.get(sentenceId) ?? 0) + 1);
      }
    }
    interTokenText = text.slice(scorables[scorables.length - 1]!.end);
  }
  for (const block of blocks) {
    for (const token of block.tokens ?? []) token.iPlus1 = false;
  }
  for (const [token, id] of assigned) {
    token.iPlus1 = isNew(token.status) && gapsBySentence.get(id) === 1;
  }
}

export function computeStats(tokens: readonly Token[], kind: ComprehensionKind): ComprehensionStats {
  let known = 0;
  let tracking = 0;
  let unknown = 0;
  const newTerms = new Set<string>();
  for (const token of tokens) {
    if (!isScorableToken(token)) continue;
    const status = token.status ?? 'unknown';
    if (status === 'known' || status === 'ignore') known++;
    else if (status === 'tracking' || status === 'learning') tracking++;
    else unknown++;
    if (isNew(status)) newTerms.add(token.term);
  }
  const total = known + tracking + unknown;
  const coverage = total === 0 ? 0 : Math.round(((known + TRACKING_WEIGHT * tracking) / total) * 1000) / 10;
  return {
    kind,
    totalTokens: total,
    knownTokens: known,
    trackingTokens: tracking,
    unknownTokens: unknown,
    coverage,
    band: bandForCoverage(coverage, kind),
    newTerms: newTerms.size,
  };
}

interface TermEntry {
  count: number;
  status: WordStatus;
}

export interface ScoreTracker {
  readonly stats: (kind: ComprehensionKind) => ComprehensionStats;
  readonly applyStatus: (term: string, status: WordStatus) => boolean;
}

export function createScoreTracker(
  tokens: readonly Token[],
  statuses: ReadonlyMap<string, WordStatus>,
  langCode: string,
): ScoreTracker {
  const byTerm = new Map<string, TermEntry>();
  let known = 0;
  let tracking = 0;
  let unknown = 0;
  let newTerms = 0;
  let total = 0;

  for (const token of tokens) {
    if (!isScorableToken(token)) continue;
    total++;
    let entry = byTerm.get(token.term);
    if (!entry) {
      entry = { count: 0, status: statuses.get(token.term) ?? 'unknown' };
      byTerm.set(token.term, entry);
      if (isNew(entry.status)) newTerms++;
    }
    entry.count++;
    if (entry.status === 'known' || entry.status === 'ignore') known++;
    else if (entry.status === 'tracking' || entry.status === 'learning') tracking++;
    else unknown++;
  }

  return {
    stats: (kind) => {
      const coverage = total === 0 ? 0 : Math.round(((known + TRACKING_WEIGHT * tracking) / total) * 1000) / 10;
      return {
        kind,
        totalTokens: total,
        knownTokens: known,
        trackingTokens: tracking,
        unknownTokens: unknown,
        coverage,
        band: bandForCoverage(coverage, kind),
        newTerms,
      };
    },
    applyStatus: (term, status) => {
      const key = langCode === 'zh' ? term : term.toLowerCase();
      const entry = byTerm.get(key);
      if (!entry || entry.status === status) return false;
      const prev = entry.status;
      entry.status = status;
      const wasNew = isNew(prev);
      const nowNew = isNew(status);
      if (wasNew && !nowNew) newTerms--;
      else if (!wasNew && nowNew) newTerms++;
      if (prev === 'known' || prev === 'ignore') known -= entry.count;
      else if (prev === 'tracking' || prev === 'learning') tracking -= entry.count;
      else unknown -= entry.count;
      if (status === 'known' || status === 'ignore') known += entry.count;
      else if (status === 'tracking' || status === 'learning') tracking += entry.count;
      else unknown += entry.count;
      return true;
    },
  };
}
