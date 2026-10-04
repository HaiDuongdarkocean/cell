import 'fake-indexeddb/auto';
import type { SrsCard, SrsMemoryComponent, SrsNote, SrsNotetype, SrsReviewSession, SrsStudyConfig, SrsVariant, VariantId } from '@/entities/srs/types';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
import { createDefaultVariants } from '@/features/srs/lib/defaultVariants';
import { resolveVariantToggles, servableVariantIds } from '@/features/srs/lib/variantFront';
import { calculateProgress } from './progressCalculator';
import { isLocked, selectNextExploreComponent } from './learningPath';
import { applyReview, createCard, resetCard, resetComponent, studyAgain } from './reviewEngine';

const adapter = createSrsFsrsAdapter();
const now = new Date('2026-09-01T00:00:00.000Z');

const makeConfig = (overrides?: Partial<SrsStudyConfig['learningPath']>): SrsStudyConfig => ({
  id: 'sc1',
  targetThreshold: 90,
  learningPath: {
    stages: ['sound', 'meaning', 'spelling'],
    progressionMode: 'parallel',
    minExplores: 1,
    ...overrides,
  },
  progressConstants: {
    rememberGainBase: 20,
    rememberGainMin: 1,
    forgetPenaltyBase: 12,
    forgetPenaltyStep: 0.1,
  },
});

const VARIANTS: readonly SrsVariant[] = createDefaultVariants();

const makeNote = (): SrsNote => ({
  id: 'n1',
  notetypeId: 'nt1',
  deckId: 'd1',
  targetWord: 'abandon',
  fields: {
    sentence: { kind: 'text', value: 'I will not abandon you.' },
    image: { kind: 'image', value: ['pic.png'] },
    wordAudio: { kind: 'audio', value: ['w.mp3'], source: 'local' },
    sentAudio: { kind: 'audio', value: ['s.mp3'], source: 'local' },
  },
  createdAt: 1,
});

const NOTETYPE: SrsNotetype = {
  id: 'nt1',
  collectionId: 'c1',
  name: 'Default',
  targetFieldId: 'target',
  fields: [
    { id: 'sentence', name: 'Sentence', type: 'text', order: 1 },
    { id: 'image', name: 'Image', type: 'image', order: 2 },
    { id: 'wordAudio', name: 'Word audio', type: 'audio', order: 3 },
    { id: 'sentAudio', name: 'Sentence audio', type: 'audio', order: 4 },
  ],
  frontTemplates: [],
  backTemplate: { fieldIds: [], showAll: true },
};

const servableOf = (note: SrsNote) => servableVariantIds(VARIANTS, note, NOTETYPE);

const makeSession = (card: SrsCard, variantId: VariantId, mode: 'explore' | 'normal' | 'studyAgain' = 'normal', note: SrsNote = makeNote()): SrsReviewSession => {
  const variant = VARIANTS.find((v) => v.id === variantId)!;
  return {
    card,
    note,
    notetype: NOTETYPE,
    variant,
    variants: VARIANTS,
    toggles: resolveVariantToggles(variant, note),
    stimulus: { type: `variant:${variantId}`, payload: {} },
    mode,
    startedAt: now.getTime(),
  };
};

const createTestCard = (config: SrsStudyConfig) =>
  createCard(makeNote(), 'd1', NOTETYPE, VARIANTS, config, now, adapter);

describe('progressCalculator', () => {
  it('gain decreases as progress increases', () => {
    const config = makeConfig();
    expect(calculateProgress({ type: 'meaning', progress: 0, exploreCount: 0, fsrsState: adapter.createEmpty(now), reviewCount: 0 } as SrsMemoryComponent, 'remember', undefined, config, 'normal')).toBe(20);
    expect(calculateProgress({ type: 'meaning', progress: 50, exploreCount: 0, fsrsState: adapter.createEmpty(now), reviewCount: 0 } as SrsMemoryComponent, 'remember', undefined, config, 'normal')).toBe(60);
  });

  it('applies penalty on forget', () => {
    const config = makeConfig();
    expect(calculateProgress({ type: 'meaning', progress: 50, exploreCount: 0, fsrsState: adapter.createEmpty(now), reviewCount: 0 } as SrsMemoryComponent, 'forget', undefined, config, 'normal')).toBe(43);
  });

  it('does not change progress in explore mode', () => {
    const config = makeConfig();
    expect(calculateProgress({ type: 'meaning', progress: 10, exploreCount: 0, fsrsState: adapter.createEmpty(now), reviewCount: 0 } as SrsMemoryComponent, 'remember', undefined, config, 'explore')).toBe(10);
  });
});

describe('learningPath', () => {
  it('locks spelling until sound and meaning are explored in sequential mode', () => {
    const config = makeConfig({ progressionMode: 'sequential', minExplores: 1 });
    const card = createTestCard(config);
    const servable = servableOf(makeNote());
    expect(isLocked(card.components.sound, card, VARIANTS, servable, config)).toBe(false);
    expect(isLocked(card.components.spelling, card, VARIANTS, servable, config)).toBe(true);
  });

  it('unlocks spelling once prior stages reach threshold', () => {
    const config = makeConfig({ progressionMode: 'sequential', minExplores: 1 });
    let card = createTestCard(config);
    const servable = servableOf(makeNote());

    for (const type of ['sound', 'meaning'] as const) {
      card = applyReview(makeSession(card, type, 'explore'), 'remember', undefined, now, config, adapter).card;
      for (let i = 0; i < 15 && card.components[type].progress < config.targetThreshold; i++) {
        card = applyReview(makeSession(card, type), 'remember', undefined, now, config, adapter).card;
      }
    }

    expect(isLocked(card.components.spelling, card, VARIANTS, servable, config)).toBe(false);
  });

  it('unservable variants never block a later variant', () => {
    const config = makeConfig({ progressionMode: 'sequential', minExplores: 1 });
    const noImage = makeNote();
    delete noImage.fields.image;
    const card0 = createCard(noImage, 'd1', NOTETYPE, VARIANTS, config, now, adapter);
    const servable = servableOf(noImage);
    expect(servable.has('meaning')).toBe(false);
    expect(isLocked(card0.components.spelling, card0, VARIANTS, servable, config)).toBe(true);
    let card = applyReview(makeSession(card0, 'sound', 'explore', noImage), 'remember', undefined, now, config, adapter).card;
    for (let i = 0; i < 15 && card.components.sound.progress < config.targetThreshold; i++) {
      card = applyReview(makeSession(card, 'sound', 'normal', noImage), 'remember', undefined, now, config, adapter).card;
    }
    expect(isLocked(card.components.spelling, card, VARIANTS, servable, config)).toBe(false);
  });

  it('selects the next explore component in order', () => {
    const config = makeConfig({ minExplores: 1 });
    const card = createTestCard(config);
    expect(selectNextExploreComponent(card, VARIANTS, servableOf(makeNote()), config)).toBe('sound');
  });
});

describe('reviewEngine', () => {
  it('creates a card with all variant components empty', () => {
    const card = createTestCard(makeConfig());
    expect(card.nextDue).toBe(now.toISOString());
    expect(card.maintenanceMode).toBe(false);
    expect(card.components.sound.progress).toBe(0);
    expect(card.components.meaning.progress).toBe(0);
    expect(card.components.spelling.progress).toBe(0);
  });

  it('applies a remember review and updates progress', () => {
    const config = makeConfig();
    const card = createTestCard(config);
    const { card: next } = applyReview(makeSession(card, 'meaning'), 'remember', undefined, now, config, adapter);
    expect(next.components.meaning.progress).toBeGreaterThan(0);
    expect(next.components.meaning.reviewCount).toBe(1);
  });

  it('dictation compares typed input against the expected field', () => {
    const config = makeConfig();
    const card = createTestCard(config);
    const wrong = applyReview(makeSession(card, 'spelling'), 'remember', 'wrong', now, config, adapter);
    expect(wrong.record.isSpellingCorrect).toBe(false);
    expect(wrong.record.dictationMode).toBe('word');
    const right = applyReview(makeSession(card, 'spelling'), 'remember', 'abandon', now, config, adapter);
    expect(right.record.isSpellingCorrect).toBe(true);
  });

  it('counts a retried-correct answer as wrong for the engine', () => {
    const config = makeConfig();
    const card = createTestCard(config);
    const clean = applyReview(makeSession(card, 'spelling'), 'remember', 'abandon', now, config, adapter);
    const retried = applyReview(makeSession(card, 'spelling'), 'remember', 'abandon', now, config, adapter, 2);
    expect(clean.record.isSpellingCorrect).toBe(true);
    expect(retried.record.isSpellingCorrect).toBe(false);
    expect(retried.record.wrongAttempts).toBe(2);
    expect(clean.card.components.spelling.progress).toBeGreaterThan(retried.card.components.spelling.progress);
  });

  it('dictation sentence mode expects the sentence', () => {
    const config = makeConfig();
    const card = createTestCard(config);
    const session = makeSession(card, 'spelling');
    const sentenceSession: SrsReviewSession = {
      ...session,
      toggles: { ...session.toggles, audio: 'sentence' },
    };
    const { record } = applyReview(sentenceSession, 'remember', 'I will not abandon you.', now, config, adapter);
    expect(record.isSpellingCorrect).toBe(true);
    expect(record.dictationMode).toBe('sentence');
  });

  it('records an explore review without changing fsrs state', () => {
    const config = makeConfig();
    const card = createTestCard(config);
    const fsrsBefore = card.components.sound.fsrsState;
    const { card: next } = applyReview(makeSession(card, 'sound', 'explore'), 'remember', undefined, now, config, adapter);
    expect(next.components.sound.fsrsState).toEqual(fsrsBefore);
    expect(next.components.sound.exploreCount).toBe(1);
  });

  it('resets a component', () => {
    const config = makeConfig();
    const note = makeNote();
    let card = createTestCard(config);
    card = applyReview(makeSession(card, 'meaning'), 'remember', undefined, now, config, adapter).card;
    card = resetComponent(card, 'meaning', note, NOTETYPE, VARIANTS, now.toISOString(), config, adapter);
    expect(card.components.meaning.progress).toBe(0);
    expect(card.components.meaning.reviewCount).toBe(0);
  });

  it('resets the whole card', () => {
    const config = makeConfig();
    const note = makeNote();
    let card = createTestCard(config);
    card = applyReview(makeSession(card, 'meaning'), 'remember', undefined, now, config, adapter).card;
    card = resetCard(card, note, NOTETYPE, VARIANTS, now.toISOString(), config, adapter);
    expect(card.components.meaning.progress).toBe(0);
    expect(card.components.sound.progress).toBe(0);
    expect(card.components.spelling.progress).toBe(0);
  });

  it('supports studyAgain and clears the due after apply', () => {
    const config = makeConfig();
    const note = makeNote();
    let card = createTestCard(config);
    card = applyReview(makeSession(card, 'sound', 'explore'), 'remember', undefined, now, config, adapter).card;
    card = applyReview(makeSession(card, 'sound'), 'remember', undefined, now, config, adapter).card;

    card = studyAgain(card, 'sound', note, NOTETYPE, VARIANTS, now.toISOString(), config, adapter);
    expect(card.studyAgainDue.sound).toBe(now.toISOString());

    const { card: final } = applyReview(makeSession(card, 'sound', 'studyAgain'), 'remember', undefined, now, config, adapter);
    expect(final.studyAgainDue.sound).toBeNull();
  });

  it('sets maintenanceMode when all servable variants reach threshold', () => {
    const config = makeConfig();
    let card = createTestCard(config);
    for (const type of ['sound', 'meaning', 'spelling'] as const) {
      card = applyReview(makeSession(card, type, 'explore'), 'remember', undefined, now, config, adapter).card;
      const typedInput = type === 'spelling' ? 'abandon' : undefined;
      for (let i = 0; i < 25 && card.components[type].progress < config.targetThreshold; i++) {
        card = applyReview(makeSession(card, type), 'remember', typedInput, now, config, adapter).card;
      }
      expect(card.components[type].progress).toBeGreaterThanOrEqual(config.targetThreshold);
    }
    expect(card.maintenanceMode).toBe(true);
  });

  it('reaches maintenanceMode even when a variant is unservable', () => {
    const config = makeConfig();
    const note = makeNote();
    delete note.fields.image;
    let card = createCard(note, 'd1', NOTETYPE, VARIANTS, config, now, adapter);
    for (const type of ['sound', 'spelling'] as const) {
      card = applyReview(makeSession(card, type, 'explore', note), 'remember', undefined, now, config, adapter).card;
      const typedInput = type === 'spelling' ? 'abandon' : undefined;
      for (let i = 0; i < 25 && card.components[type].progress < config.targetThreshold; i++) {
        card = applyReview(makeSession(card, type, 'normal', note), 'remember', typedInput, now, config, adapter).card;
      }
    }
    expect(card.maintenanceMode).toBe(true);
  });
});
