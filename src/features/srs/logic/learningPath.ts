import type { SrsCard, SrsMemoryComponent, SrsStudyConfig, SrsVariant, VariantId } from '@/entities/srs/types';

/**
 * Determine whether a variant component is locked by learning-path ordering.
 * `servable` filters the variant list — unservable variants never block progress.
 */
export function isLocked(
  component: SrsMemoryComponent,
  card: SrsCard,
  variants: readonly SrsVariant[],
  servable: ReadonlySet<VariantId>,
  config: SrsStudyConfig,
): boolean {
  const { progressionMode } = config.learningPath;
  const idx = variants.findIndex((v) => v.id === component.type);
  if (idx < 0) return false;

  const variant = variants[idx];
  if (component.exploreCount < variant.newLoops) {
    for (let i = 0; i < idx; i++) {
      const v = variants[i];
      if (!servable.has(v.id)) continue;
      if ((card.components[v.id]?.exploreCount ?? 0) < v.newLoops) return true;
    }
    return false;
  }

  if (progressionMode !== 'sequential') return false;
  for (let i = 0; i < idx; i++) {
    const v = variants[i];
    if (!servable.has(v.id)) continue;
    if ((card.components[v.id]?.progress ?? 0) < config.targetThreshold) return true;
  }
  return false;
}

/** Pick the next variant that still needs exploration on this card and is not locked. */
export function selectNextExploreComponent(
  card: SrsCard,
  variants: readonly SrsVariant[],
  servable: ReadonlySet<VariantId>,
  config: SrsStudyConfig,
): VariantId | null {
  for (const variant of variants) {
    if (!servable.has(variant.id)) continue;
    const comp = card.components[variant.id];
    if (!comp) continue;
    if (comp.exploreCount < variant.newLoops && !isLocked(comp, card, variants, servable, config)) {
      return variant.id;
    }
  }
  return null;
}
