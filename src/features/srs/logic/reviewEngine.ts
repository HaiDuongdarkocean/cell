import type { ComponentType, SrsCard, SrsMemoryComponent, SrsReviewRecord, SrsReviewSession, SrsStudyConfig } from '@/entities/srs/types';
import type { SrsFsrsAdapter } from '@/entities/srs/types';
import { generateId, minISO, FUTURE_ISO, normalizeSpelling } from '@/features/srs/lib/helpers';
import { calculateProgress } from './progressCalculator';
import { selectNextExploreComponent } from './learningPath';

export interface ApplyReviewResult {
  readonly card: SrsCard;
  readonly record: SrsReviewRecord;
}

/** Recalculate derived card fields after any write. */
export function recalcCard(
  card: SrsCard,
  config: SrsStudyConfig,
  now: string,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const comps = { ...card.components };
  const studyAgainDue = { ...card.studyAgainDue };

  // Drop study-again dues that are still in the future.
  for (const t of Object.keys(studyAgainDue) as ComponentType[]) {
    const due = studyAgainDue[t];
    if (due && due > now) {
      studyAgainDue[t] = null;
    }
  }

  const effectiveDues = (Object.keys(comps) as ComponentType[]).map((t) => {
    const fsrsDue = adapter.getDue(comps[t].fsrsState);
    const study = studyAgainDue[t];
    if (study && study <= fsrsDue) return study;
    return fsrsDue;
  });

  const exploreType = selectNextExploreComponent(card, config);
  const exploreDue = exploreType ? now : FUTURE_ISO;

  const nextDue = minISO(...effectiveDues, exploreDue);
  const maintenanceMode = Object.values(comps).every((c) => c.progress >= config.targetThreshold);

  return { ...card, components: comps, studyAgainDue, nextDue, maintenanceMode };
}

/** Apply a learner's judgment to a review session. */
export function applyReview(
  session: SrsReviewSession,
  judgment: 'forget' | 'remember',
  typedInput: string | undefined,
  now: Date,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): ApplyReviewResult {
  const { card, note, componentType, template, mode } = session;
  const comp = card.components[componentType];

  const isSpellingCorrect =
    componentType === 'spelling' && typedInput !== undefined
      ? normalizeSpelling(typedInput) === normalizeSpelling(note.targetWord)
      : undefined;

  const newProgress = calculateProgress(comp, judgment, isSpellingCorrect ?? false, config, mode);

  // FSRS only advances in normal/studyAgain modes; explore mode preserves fsrsState.
  const newFsrsState =
    mode === 'explore'
      ? comp.fsrsState
      : adapter.next(comp.fsrsState, now, judgment, mode === 'studyAgain');

  const newComp: SrsMemoryComponent = {
    ...comp,
    progress: newProgress,
    exploreCount: comp.exploreCount + (mode === 'explore' ? 1 : 0),
    fsrsState: newFsrsState,
    reviewCount: comp.reviewCount + 1,
  };

  let newCard: SrsCard = {
    ...card,
    components: { ...card.components, [componentType]: newComp },
  };

  if (mode === 'studyAgain') {
    newCard = { ...newCard, studyAgainDue: { ...newCard.studyAgainDue, [componentType]: null } };
  }

  newCard = recalcCard(newCard, config, now.toISOString(), adapter);

  const record: SrsReviewRecord = {
    id: generateId(),
    cardId: card.id,
    noteId: note.id,
    notetypeId: note.notetypeId,
    componentType,
    templateId: template.id,
    stimulusType: template.stimulusType,
    startedAt: session.startedAt,
    answeredAt: now.getTime(),
    judgment,
    typedInput,
    isSpellingCorrect,
    isStudyAgain: mode === 'studyAgain',
    resultingProgress: newProgress,
    resultingFsrsState: newFsrsState,
  };

  return { card: newCard, record };
}

/** Mark a component for immediate restudy within the same session. */
export function studyAgain(
  card: SrsCard,
  type: ComponentType,
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const comp = card.components[type];
  if (comp.exploreCount < config.learningPath.minExplores) return card;

  const updated: SrsCard = {
    ...card,
    studyAgainDue: { ...card.studyAgainDue, [type]: now },
  };
  return recalcCard(updated, config, now, adapter);
}

/** Reset a single component back to empty. */
export function resetComponent(
  card: SrsCard,
  type: ComponentType,
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const empty = adapter.createEmpty(new Date(now));
  const updated: SrsCard = {
    ...card,
    components: {
      ...card.components,
      [type]: {
        type,
        progress: 0,
        exploreCount: 0,
        fsrsState: empty,
        reviewCount: 0,
      },
    },
    studyAgainDue: { ...card.studyAgainDue, [type]: null },
  };
  return recalcCard(updated, config, now, adapter);
}

/** Reset the entire card back to empty. */
export function resetCard(
  card: SrsCard,
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const empty = adapter.createEmpty(new Date(now));
  const updated: SrsCard = {
    ...card,
    components: {
      meaning: { type: 'meaning', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
      sound: { type: 'sound', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
      spelling: { type: 'spelling', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
    },
    studyAgainDue: { meaning: null, sound: null, spelling: null },
  };
  return recalcCard(updated, config, now, adapter);
}

/** Create a new card for a note. */
export function createCard(
  note: { readonly id: string },
  deckId: string,
  config: SrsStudyConfig,
  now: Date,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const empty = adapter.createEmpty(now);
  const createdAt = now.getTime();
  const raw: SrsCard = {
    id: generateId(),
    noteId: note.id,
    deckId,
    components: {
      meaning: { type: 'meaning', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
      sound: { type: 'sound', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
      spelling: { type: 'spelling', progress: 0, exploreCount: 0, fsrsState: empty, reviewCount: 0 },
    },
    studyAgainDue: { meaning: null, sound: null, spelling: null },
    createdAt,
    nextDue: now.toISOString(),
    maintenanceMode: false,
  };
  return recalcCard(raw, config, now.toISOString(), adapter);
}
