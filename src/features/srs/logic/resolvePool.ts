import type { Pool, SrsCard, SrsFsrsAdapter, SrsStudyConfig, SrsVariant, VariantId } from '@/entities/srs/types';
import { FUTURE_ISO, minISO } from '@/features/srs/lib/helpers';
import { isLocked, selectNextExploreComponent } from './learningPath';

/** Classify a variant component into a scheduling pool. Returns null when not due, locked, unservable, or absent. */
export function resolvePool(
  card: SrsCard,
  variantId: VariantId,
  variants: readonly SrsVariant[],
  servable: ReadonlySet<VariantId>,
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): Pool | null {
  const comp = card.components[variantId];
  if (!comp) return null;
  if (!servable.has(variantId)) return null;

  const exploreId = selectNextExploreComponent(card, variants, servable, config);
  if (exploreId === variantId) return 'explore';

  const fsrsDue = adapter.getDue(comp.fsrsState);
  const studyAgain = card.studyAgainDue[variantId];
  const effectiveDue = minISO(fsrsDue, studyAgain ?? FUTURE_ISO);

  if (effectiveDue > now) return null;
  if (isLocked(comp, card, variants, servable, config)) return null;

  if (studyAgain && studyAgain <= now) return 'studyAgain';

  if (comp.progress >= config.targetThreshold) {
    return card.maintenanceMode ? 'maintenance' : 'satisfied';
  }

  return 'active';
}
