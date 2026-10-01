import type { NormalizedAnkiNotetype } from '../model/normalized';

export function pillNotetypes(
  notetypes: readonly NormalizedAnkiNotetype[],
  enabledIds: ReadonlySet<string>,
  cardCounts: ReadonlyMap<string, number>,
): NormalizedAnkiNotetype[] {
  return notetypes.filter((n) => enabledIds.has(n.id) && (cardCounts.get(n.id) ?? 0) > 0);
}

export function nextEnabledNotetypeId(
  notetypes: readonly NormalizedAnkiNotetype[],
  enabledIds: ReadonlySet<string>,
  cardCounts: ReadonlyMap<string, number>,
  afterId: string,
): string | null {
  const idx = Math.max(0, notetypes.findIndex((n) => n.id === afterId));
  for (let k = 1; k <= notetypes.length; k += 1) {
    const cand = notetypes[(idx + k) % notetypes.length];
    if (cand && enabledIds.has(cand.id) && (cardCounts.get(cand.id) ?? 0) > 0) return cand.id;
  }
  return null;
}
