import type { PoolCandidate } from '@/entities/srs/types';

const POOL_ORDER: readonly PoolCandidate['pool'][] = ['explore', 'studyAgain', 'active', 'satisfied', 'maintenance'];

/** Pick the highest-priority candidate using a bucketed O(n) scan. */
export function pickHighestPriority(candidates: readonly PoolCandidate[]): PoolCandidate | null {
  for (const pool of POOL_ORDER) {
    let best: PoolCandidate | undefined;
    for (const c of candidates) {
      if (c.pool !== pool) continue;
      if (!best) {
        best = c;
        continue;
      }
      if (c.effectiveDue < best.effectiveDue) {
        best = c;
      } else if (c.effectiveDue === best.effectiveDue && c.progress < best.progress) {
        best = c;
      }
    }
    if (best) return best;
  }
  return null;
}
