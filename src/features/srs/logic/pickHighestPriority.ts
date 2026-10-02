import type { PoolCandidate } from '@/entities/srs/types';

const POOL_ORDER: readonly PoolCandidate['pool'][] = ['explore', 'studyAgain', 'active', 'satisfied', 'maintenance'];
const REVIEW_FIRST_ORDER: readonly PoolCandidate['pool'][] = ['studyAgain', 'active', 'satisfied', 'maintenance', 'explore'];

/** Pick the highest-priority candidate using a bucketed O(n) scan. */
export function pickHighestPriority(
  candidates: readonly PoolCandidate[],
  options: { readonly startWith?: 'reviews' | 'new'; readonly shuffle?: boolean } = {},
): PoolCandidate | null {
  const order = options.startWith === 'reviews' ? REVIEW_FIRST_ORDER : POOL_ORDER;
  for (const pool of order) {
    let best: PoolCandidate | undefined;
    for (const c of candidates) {
      if (c.pool !== pool) continue;
      if (!best) {
        best = c;
        continue;
      }
      if (options.shuffle) {
        if (Math.random() < 0.5) best = c;
      } else if (c.effectiveDue < best.effectiveDue) {
        best = c;
      } else if (c.effectiveDue === best.effectiveDue && c.progress < best.progress) {
        best = c;
      }
    }
    if (best) return best;
  }
  return null;
}

/** Ordered candidate list — same priority rules as pickHighestPriority, for ordered-skip scanning. */
export function orderCandidates(
  candidates: readonly PoolCandidate[],
  options: { readonly startWith?: 'reviews' | 'new'; readonly shuffle?: boolean } = {},
): PoolCandidate[] {
  const order = options.startWith === 'reviews' ? REVIEW_FIRST_ORDER : POOL_ORDER;
  const result: PoolCandidate[] = [];
  for (const pool of order) {
    const bucket = candidates.filter((c) => c.pool === pool);
    if (options.shuffle) {
      for (let i = bucket.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bucket[i], bucket[j]] = [bucket[j], bucket[i]];
      }
    } else {
      bucket.sort((a, b) =>
        a.effectiveDue === b.effectiveDue
          ? a.progress - b.progress
          : a.effectiveDue < b.effectiveDue
            ? -1
            : 1,
      );
    }
    result.push(...bucket);
  }
  return result;
}
