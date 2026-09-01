import type { ComponentType, SrsCard, SrsMemoryComponent, SrsStudyConfig } from '@/entities/srs/types';

/** Determine whether a component is locked by its learning path configuration. */
export function isLocked(
  component: SrsMemoryComponent,
  card: SrsCard,
  config: SrsStudyConfig,
): boolean {
  const { stages, progressionMode, minExplores } = config.learningPath;
  const idx = stages.indexOf(component.type);
  if (idx < 0) return false;

  // Explore phase: a component stays locked until all earlier stages have been explored.
  if (component.exploreCount < minExplores) {
    for (let i = 0; i < idx; i++) {
      if (card.components[stages[i]].exploreCount < minExplores) return true;
    }
    return false;
  }

  if (progressionMode === 'parallel') return false;
  if (progressionMode === 'sequential') {
    for (let i = 0; i < idx; i++) {
      if (card.components[stages[i]].progress < config.targetThreshold) return true;
    }
    return false;
  }

  return false;
}

/** Pick the next component that still needs exploration and is not locked. */
export function selectNextExploreComponent(card: SrsCard, config: SrsStudyConfig): ComponentType | null {
  const { stages, minExplores } = config.learningPath;
  for (const type of stages) {
    const comp = card.components[type];
    if (comp.exploreCount < minExplores && !isLocked(comp, card, config)) return type;
  }
  return null;
}
