import type { WordStatus } from '@/entities/dictionary';
import type { ComprehensionBand, ComprehensionKind, ComprehensionStats } from '@/entities/comprehension';
import type { Token } from '@/features/tokenize/types';

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
