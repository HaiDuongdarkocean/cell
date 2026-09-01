import type { ComponentType, Pool, SrsCard, SrsFsrsAdapter, SrsStudyConfig } from '@/entities/srs/types';
import { FUTURE_ISO, minISO } from '@/features/srs/lib/helpers';
import { isLocked, selectNextExploreComponent } from './learningPath';

/** Classify a component into a scheduling pool. Returns null when not due or locked. */
export function resolvePool(
  card: SrsCard,
  type: ComponentType,
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): Pool | null {
  const comp = card.components[type];

  const exploreType = selectNextExploreComponent(card, config);
  if (exploreType === type) return 'explore';

  const fsrsDue = adapter.getDue(comp.fsrsState);
  const studyAgain = card.studyAgainDue[type];
  const effectiveDue = minISO(fsrsDue, studyAgain ?? FUTURE_ISO);

  if (effectiveDue > now) return null;
  if (isLocked(comp, card, config)) return null;

  if (studyAgain && studyAgain <= now) return 'studyAgain';

  if (comp.progress >= config.targetThreshold) {
    return card.maintenanceMode ? 'maintenance' : 'satisfied';
  }

  return 'active';
}
