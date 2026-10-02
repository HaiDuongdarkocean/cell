import type { SrsCard, SrsMemoryComponent, SrsNote, SrsNotetype, SrsReviewRecord, SrsReviewSession, SrsStudyConfig, SrsVariant, VariantId } from '@/entities/srs/types';
import type { SrsFsrsAdapter } from '@/entities/srs/types';
import { generateId, minISO, FUTURE_ISO, normalizeSpelling } from '@/features/srs/lib/helpers';
import { expectedInputField, expectedInputText, servableVariantIds } from '@/features/srs/lib/variantFront';
import { calculateProgress } from './progressCalculator';
import { selectNextExploreComponent } from './learningPath';

export interface ApplyReviewResult {
  readonly card: SrsCard;
  readonly record: SrsReviewRecord;
}

function emptyComponent(type: VariantId, adapter: SrsFsrsAdapter, now: string): SrsMemoryComponent {
  return { type, progress: 0, exploreCount: 0, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 };
}

/**
 * Recalculate derived card fields after any write: reconcile components against the
 * preset variants (missing ones are created empty, orphans are kept but ignored),
 * drop stale study-again dues, recompute nextDue and maintenanceMode over servable variants.
 */
export function recalcCard(
  card: SrsCard,
  variants: readonly SrsVariant[],
  servable: ReadonlySet<VariantId>,
  config: SrsStudyConfig,
  now: string,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const comps = { ...card.components };
  for (const v of variants) {
    comps[v.id] ??= emptyComponent(v.id, adapter, now);
  }
  const withComps: SrsCard = { ...card, components: comps };

  const studyAgainDue = { ...card.studyAgainDue };
  for (const t of Object.keys(studyAgainDue)) {
    const due = studyAgainDue[t];
    if (due && due > now) {
      studyAgainDue[t] = null;
    }
  }

  const effectiveDues = variants
    .filter((v) => servable.has(v.id))
    .map((v) => {
      const fsrsDue = adapter.getDue(comps[v.id].fsrsState);
      const study = studyAgainDue[v.id];
      if (study && study <= fsrsDue) return study;
      return fsrsDue;
    });

  const exploreType = selectNextExploreComponent(withComps, variants, servable, config);
  const exploreDue = exploreType ? now : FUTURE_ISO;

  const nextDue = minISO(...effectiveDues, exploreDue);
  const servableComps = variants.filter((v) => servable.has(v.id)).map((v) => comps[v.id]);
  const maintenanceMode =
    servableComps.length > 0 && servableComps.every((c) => c.progress >= config.targetThreshold);

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
  const { card, note, variant, toggles, mode } = session;
  const variantId = variant.id;
  const comp = card.components[variantId] ?? emptyComponent(variantId, adapter, now.toISOString());

  const expectedField = expectedInputField(variant, note, toggles);
  const expectedText = expectedField ? expectedInputText(variant, note, toggles) : null;
  const isSpellingCorrect =
    expectedText !== null && typedInput !== undefined
      ? normalizeSpelling(typedInput) === normalizeSpelling(expectedText)
      : undefined;

  const newProgress = calculateProgress(comp, judgment, isSpellingCorrect ?? false, config, mode);

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
    components: { ...card.components, [variantId]: newComp },
  };

  if (mode === 'studyAgain') {
    newCard = { ...newCard, studyAgainDue: { ...newCard.studyAgainDue, [variantId]: null } };
  }

  const servable = servableVariantIds(session.variants, note, session.notetype);
  newCard = recalcCard(newCard, session.variants, servable, config, now.toISOString(), adapter);

  const record: SrsReviewRecord = {
    id: generateId(),
    cardId: card.id,
    noteId: note.id,
    notetypeId: note.notetypeId,
    componentType: variantId,
    templateId: `variant:${variantId}`,
    stimulusType: session.stimulus.type,
    startedAt: session.startedAt,
    answeredAt: now.getTime(),
    judgment,
    typedInput,
    isSpellingCorrect,
    isStudyAgain: mode === 'studyAgain',
    resultingProgress: newProgress,
    resultingFsrsState: newFsrsState,
    dictationMode: expectedField ? (expectedField === 'sentence' ? 'sentence' : 'word') : undefined,
  };

  return { card: newCard, record };
}

/** Mark a variant component for immediate restudy within the same session. */
export function studyAgain(
  card: SrsCard,
  variantId: VariantId,
  note: SrsNote,
  notetype: SrsNotetype,
  variants: readonly SrsVariant[],
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const variant = variants.find((v) => v.id === variantId);
  const comp = card.components[variantId];
  if (!variant || !comp) return card;
  if (comp.exploreCount < variant.newLoops) return card;

  const updated: SrsCard = {
    ...card,
    studyAgainDue: { ...card.studyAgainDue, [variantId]: now },
  };
  const servable = servableVariantIds(variants, note, notetype);
  return recalcCard(updated, variants, servable, config, now, adapter);
}

/** Reset a single variant component back to empty. */
export function resetComponent(
  card: SrsCard,
  variantId: VariantId,
  note: SrsNote,
  notetype: SrsNotetype,
  variants: readonly SrsVariant[],
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const updated: SrsCard = {
    ...card,
    components: { ...card.components, [variantId]: emptyComponent(variantId, adapter, now) },
    studyAgainDue: { ...card.studyAgainDue, [variantId]: null },
  };
  const servable = servableVariantIds(variants, note, notetype);
  return recalcCard(updated, variants, servable, config, now, adapter);
}

/** Reset the entire card — every component back to empty. */
export function resetCard(
  card: SrsCard,
  note: SrsNote,
  notetype: SrsNotetype,
  variants: readonly SrsVariant[],
  now: string,
  config: SrsStudyConfig,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const components: Record<string, SrsMemoryComponent> = {};
  for (const id of new Set([...variants.map((v) => v.id), ...Object.keys(card.components)])) {
    components[id] = emptyComponent(id, adapter, now);
  }
  const updated: SrsCard = { ...card, components, studyAgainDue: {} };
  const servable = servableVariantIds(variants, note, notetype);
  return recalcCard(updated, variants, servable, config, now, adapter);
}

/** Create a new card for a note — components initialized for all preset variants. */
export function createCard(
  note: SrsNote,
  deckId: string,
  notetype: SrsNotetype,
  variants: readonly SrsVariant[],
  config: SrsStudyConfig,
  now: Date,
  adapter: SrsFsrsAdapter,
): SrsCard {
  const createdAt = now.getTime();
  const raw: SrsCard = {
    id: generateId(),
    noteId: note.id,
    deckId,
    components: {},
    studyAgainDue: {},
    createdAt,
    nextDue: now.toISOString(),
    maintenanceMode: false,
  };
  const servable = servableVariantIds(variants, note, notetype);
  return recalcCard(raw, variants, servable, config, now.toISOString(), adapter);
}
