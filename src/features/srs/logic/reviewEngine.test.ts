import 'fake-indexeddb/auto';
import type { SrsCard, SrsMemoryComponent, SrsReviewSession, SrsStudyConfig } from '@/entities/srs/types';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
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

const makeNote = () => ({
  id: 'n1',
  notetypeId: 'nt1',
  deckId: 'd1',
  targetWord: 'abandon',
  fields: { target: { kind: 'text' as const, value: 'abandon' } },
  createdAt: 1,
});

const makeSession = (card: SrsCard, componentType: 'meaning' | 'sound' | 'spelling', mode: 'explore' | 'normal' | 'studyAgain' = 'normal'): SrsReviewSession => ({
  card,
  note: makeNote(),
  notetype: {
    id: 'nt1',
    collectionId: 'c1',
    name: 'Default',
    targetFieldId: 'target',
    fields: [],
    frontTemplates: [{
      id: 't1',
      componentType,
      stimulusType: 'definition',
      fieldIds: ['target'],
      requiresInput: false,
    }],
    backTemplate: { fieldIds: ['target'], showAll: true },
  },
  componentType,
  template: {
    id: 't1',
    componentType,
    stimulusType: 'definition',
    fieldIds: ['target'],
    requiresInput: false,
  },
  stimulus: { type: 'definition', payload: { kind: 'text' as const, value: 'to leave behind' } },
  mode,
  startedAt: now.getTime(),
});

describe('progressCalculator', () => {
  it('gain decreases as progress increases', () => {
    const config = makeConfig();
    expect(calculateProgress({ type: 'meaning', progress: 0, exploreCount: 0, fsrsState: adapter.createEmpty(now), reviewCount: 0 } as SrsMemoryComponent, 'remember', false, config, 'normal')).toBe(20);
    expect(calculateProgress({ type: 'meaning', progress: 50, exploreCount: 0, fsrsState: adapter.createEmpty(now), reviewCount: 0 } as SrsMemoryComponent, 'remember', false, config, 'normal')).toBe(60);
  });

  it('applies penalty on forget', () => {
    const config = makeConfig();
    expect(calculateProgress({ type: 'meaning', progress: 50, exploreCount: 0, fsrsState: adapter.createEmpty(now), reviewCount: 0 } as SrsMemoryComponent, 'forget', false, config, 'normal')).toBe(43);
  });

  it('does not change progress in explore mode', () => {
    const config = makeConfig();
    expect(calculateProgress({ type: 'meaning', progress: 10, exploreCount: 0, fsrsState: adapter.createEmpty(now), reviewCount: 0 } as SrsMemoryComponent, 'remember', false, config, 'explore')).toBe(10);
  });
});

describe('learningPath', () => {
  it('locks spelling until sound and meaning are explored in sequential mode', () => {
    const config = makeConfig({ progressionMode: 'sequential', minExplores: 1 });
    const card = createCard(makeNote(), 'd1', config, now, adapter);
    expect(isLocked(card.components.sound, card, config)).toBe(false);
    expect(isLocked(card.components.spelling, card, config)).toBe(true);
  });

  it('unlocks spelling once prior stages reach threshold', () => {
    const config = makeConfig({ progressionMode: 'sequential', minExplores: 1 });
    let card = createCard(makeNote(), 'd1', config, now, adapter);

    for (const type of ['sound', 'meaning'] as const) {
      card = applyReview(makeSession(card, type, 'explore'), 'remember', undefined, now, config, adapter).card;
      for (let i = 0; i < 15 && card.components[type].progress < config.targetThreshold; i++) {
        card = applyReview(makeSession(card, type), 'remember', undefined, now, config, adapter).card;
      }
    }

    expect(isLocked(card.components.spelling, card, config)).toBe(false);
  });

  it('selects the next explore component in order', () => {
    const config = makeConfig({ minExplores: 1 });
    const card = createCard(makeNote(), 'd1', config, now, adapter);
    expect(selectNextExploreComponent(card, config)).toBe('sound');
  });
});

describe('reviewEngine', () => {
  it('creates a card with all components empty', () => {
    const card = createCard(makeNote(), 'd1', makeConfig(), now, adapter);
    expect(card.nextDue).toBe(now.toISOString());
    expect(card.maintenanceMode).toBe(false);
    expect(card.components.sound.progress).toBe(0);
  });

  it('applies a remember review and updates progress', () => {
    const config = makeConfig();
    const card = createCard(makeNote(), 'd1', config, now, adapter);
    const { card: next } = applyReview(makeSession(card, 'meaning'), 'remember', undefined, now, config, adapter);
    expect(next.components.meaning.progress).toBeGreaterThan(0);
    expect(next.components.meaning.reviewCount).toBe(1);
  });

  it('records an explore review without changing fsrs state', () => {
    const config = makeConfig();
    const card = createCard(makeNote(), 'd1', config, now, adapter);
    const fsrsBefore = card.components.sound.fsrsState;
    const { card: next } = applyReview(makeSession(card, 'sound', 'explore'), 'remember', undefined, now, config, adapter);
    expect(next.components.sound.fsrsState).toEqual(fsrsBefore);
    expect(next.components.sound.exploreCount).toBe(1);
  });

  it('resets a component', () => {
    const config = makeConfig();
    let card = createCard(makeNote(), 'd1', config, now, adapter);
    card = applyReview(makeSession(card, 'meaning'), 'remember', undefined, now, config, adapter).card;
    card = resetComponent(card, 'meaning', now.toISOString(), config, adapter);
    expect(card.components.meaning.progress).toBe(0);
    expect(card.components.meaning.reviewCount).toBe(0);
  });

  it('resets the whole card', () => {
    const config = makeConfig();
    let card = createCard(makeNote(), 'd1', config, now, adapter);
    card = applyReview(makeSession(card, 'meaning'), 'remember', undefined, now, config, adapter).card;
    card = resetCard(card, now.toISOString(), config, adapter);
    expect(card.components.meaning.progress).toBe(0);
    expect(card.components.sound.progress).toBe(0);
    expect(card.components.spelling.progress).toBe(0);
  });

  it('supports studyAgain and clears the due after apply', () => {
    const config = makeConfig();
    let card = createCard(makeNote(), 'd1', config, now, adapter);
    // First explore sound so it's eligible for studyAgain.
    card = applyReview(makeSession(card, 'sound', 'explore'), 'remember', undefined, now, config, adapter).card;
    card = applyReview(makeSession(card, 'sound'), 'remember', undefined, now, config, adapter).card;

    card = studyAgain(card, 'sound', now.toISOString(), config, adapter);
    expect(card.studyAgainDue.sound).toBe(now.toISOString());

    const { card: final } = applyReview(makeSession(card, 'sound', 'studyAgain'), 'remember', undefined, now, config, adapter);
    expect(final.studyAgainDue.sound).toBeNull();
  });

  it('sets maintenanceMode when all components reach threshold', () => {
    const config = makeConfig();
    let card = createCard(makeNote(), 'd1', config, now, adapter);
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
});
