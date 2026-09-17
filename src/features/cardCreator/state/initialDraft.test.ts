import { buildInitialDraft, type InitialDraftDefaults } from './initialDraft';
import type { CardDraft } from './cardDraft';
import type { CardCreatorOpenContext } from '../types';
import type { MediaFile } from '../media/mediaFile';

const defaults: InitialDraftDefaults = {
  noteType: 'Basic',
  deck: 'Default',
  tags: 'tag1',
  mediaUpdateMode: 'overwrite',
};

const image: MediaFile = {
  kind: 'image',
  filename: 'i.png',
  mimeType: 'image/png',
  data: new ArrayBuffer(1),
};
const audio: MediaFile = {
  kind: 'audio',
  filename: 'a.mp3',
  mimeType: 'audio/mpeg',
  data: new ArrayBuffer(1),
};

const restored: CardDraft = {
  noteType: 'Restored',
  deck: 'RestoredDeck',
  fields: {
    targetWord: 'x',
    sentence: 'x',
    sentenceTranslation: 'x',
    definitions: 'x',
    images: [],
    sentenceAudios: [],
    wordAudios: [],
    note: 'x',
    moreExample: 'x',
  },
  fieldMapping: { targetWord: 'Front' },
  tags: 'restoredTags',
  mediaUpdateMode: 'skip',
};

describe('buildInitialDraft', () => {
  it('builds a non-queue draft from prefill + cue', () => {
    const ctx: CardCreatorOpenContext = {
      sourceLang: 'en',
      targetLang: 'vi',
      cue: { index: 0, start: 0, end: 1, targetText: 'cue text', nativeText: 'cue native' },
      prefill: { targetWord: 'book', sentence: 'pre s', sentenceTranslation: 'pre t', definitions: 'd', note: 'n', moreExample: 'm' },
      initialMedia: [image, audio],
    };
    const plan = buildInitialDraft(ctx, null, defaults);
    expect(plan.queueItems).toEqual([]);
    expect(plan.queueActiveIndex).toBe(-1);
    expect(plan.queueSidebarOpen).toBe(false);
    expect(plan.activeQueueTerm).toBe('');
    expect(plan.draft.fields.targetWord).toBe('book');
    expect(plan.draft.fields.sentence).toBe('pre s');
    expect(plan.draft.fields.sentenceTranslation).toBe('pre t');
    expect(plan.draft.fields.images).toEqual([image]);
    expect(plan.draft.fields.sentenceAudios).toEqual([audio]);
    expect(plan.draft.noteType).toBe('Basic');
    expect(plan.draft.tags).toBe('tag1');
  });

  it('falls back to cue text when prefill lacks it', () => {
    const ctx: CardCreatorOpenContext = {
      sourceLang: 'en',
      targetLang: 'vi',
      cue: { index: 0, start: 0, end: 1, targetText: 'cue text', nativeText: 'cue native' },
    };
    const plan = buildInitialDraft(ctx, null, defaults);
    expect(plan.draft.fields.sentence).toBe('cue text');
    expect(plan.draft.fields.sentenceTranslation).toBe('cue native');
  });

  it('applies restored config values', () => {
    const ctx: CardCreatorOpenContext = { sourceLang: 'en', targetLang: 'vi' };
    const plan = buildInitialDraft(ctx, restored, defaults);
    expect(plan.draft.noteType).toBe('Restored');
    expect(plan.draft.deck).toBe('RestoredDeck');
    expect(plan.draft.fieldMapping).toEqual({ targetWord: 'Front' });
    expect(plan.draft.tags).toBe('restoredTags');
    expect(plan.draft.mediaUpdateMode).toBe('skip');
  });

  it('builds a queue draft with the first item active', () => {
    const ctx: CardCreatorOpenContext = {
      sourceLang: 'en',
      targetLang: 'vi',
      queue: [
        { term: 'apple', definitions: 'def a', status: 'unknown' },
        { term: 'car', definitions: 'def c', status: 'tracking' },
      ],
    };
    const plan = buildInitialDraft(ctx, null, defaults);
    expect(plan.queueActiveIndex).toBe(0);
    expect(plan.queueSidebarOpen).toBe(true);
    expect(plan.activeQueueTerm).toBe('apple');
    expect(plan.draft.fields.targetWord).toBe('apple');
    expect(plan.draft.fields.definitions).toBe('def a');
  });

  it('activates the queue item matching the prefill term', () => {
    const ctx: CardCreatorOpenContext = {
      sourceLang: 'en',
      targetLang: 'vi',
      queue: [
        { term: 'apple', definitions: 'def a', status: 'unknown' },
        { term: 'Car', definitions: 'def c', status: 'tracking' },
      ],
      prefill: { targetWord: 'car', definitions: 'prefill def' },
    };
    const plan = buildInitialDraft(ctx, null, defaults);
    expect(plan.queueActiveIndex).toBe(1);
    expect(plan.activeQueueTerm).toBe('Car');
    expect(plan.draft.fields.definitions).toBe('prefill def');
  });

  it('uses queue item definitions when prefill term does not match the active item', () => {
    const ctx: CardCreatorOpenContext = {
      sourceLang: 'en',
      targetLang: 'vi',
      queue: [{ term: 'apple', definitions: 'def a', status: 'unknown' }],
      prefill: { targetWord: 'other', definitions: 'prefill def' },
    };
    const plan = buildInitialDraft(ctx, null, defaults);
    expect(plan.queueActiveIndex).toBe(0);
    expect(plan.draft.fields.targetWord).toBe('apple');
    expect(plan.draft.fields.definitions).toBe('def a');
  });

  it('hides the sidebar for a single-item queue', () => {
    const ctx: CardCreatorOpenContext = {
      sourceLang: 'en',
      targetLang: 'vi',
      queue: [{ term: 'solo', definitions: '', status: 'unknown' }],
    };
    const plan = buildInitialDraft(ctx, null, defaults);
    expect(plan.queueSidebarOpen).toBe(false);
  });
});
