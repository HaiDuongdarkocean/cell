import 'fake-indexeddb/auto';
import type { SrsCard, SrsNotetype, SrsStudyConfig } from '@/entities/srs/types';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
import { putCollection } from '@/features/srs/repositories/collectionRepository';
import { putDeck } from '@/features/srs/repositories/deckRepository';
import { putNotetype } from '@/features/srs/repositories/notetypeRepository';
import { putNote } from '@/features/srs/repositories/noteRepository';
import { putCard } from '@/features/srs/repositories/cardRepository';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from '@/features/srs/repositories/srsDatabase';
import { applyReview } from './reviewEngine';
import { selectNextReview } from './selectNextReview';

const storageLocalGetMock = jest.fn<Promise<Record<string, unknown>>, [string | string[] | null]>();

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: storageLocalGetMock as unknown as typeof chrome.storage.local.get,
        set: jest.fn(),
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  storageLocalGetMock.mockReset();
  storageLocalGetMock.mockResolvedValue({});
  closeAllSrsDBs();
});

beforeEach(async () => {
  await clearAllSrsStores();
});

afterEach(() => {
  closeAllSrsDBs();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  const dbName = await getSrsDbName();
  await deleteSrsDB(dbName);
});

const now = '2026-09-01T00:00:00.000Z';
const adapter = createSrsFsrsAdapter();

const makeConfig = (): SrsStudyConfig => ({
  id: 'sc1',
  targetThreshold: 90,
  learningPath: { stages: ['sound', 'meaning', 'spelling'], progressionMode: 'parallel', minExplores: 1 },
  progressConstants: { rememberGainBase: 20, rememberGainMin: 1, forgetPenaltyBase: 12, forgetPenaltyStep: 0.1 },
});

const makeNotetype = (): SrsNotetype => ({
  id: 'nt1',
  collectionId: 'c1',
  name: 'Test',
  targetFieldId: 'target',
  fields: [
    { id: 'target', name: 'Target', order: 0, type: 'text' },
    { id: 'def', name: 'Definition', order: 1, type: 'text' },
    { id: 'sentence', name: 'Sentence', order: 2, type: 'text' },
  ],
  frontTemplates: [
    { id: 't-sound', componentType: 'sound', stimulusType: 'ipa', fieldIds: ['target'], requiresInput: false },
    { id: 't-meaning', componentType: 'meaning', stimulusType: 'definition', fieldIds: ['def'], requiresInput: false },
    { id: 't-spelling', componentType: 'spelling', stimulusType: 'sentence', fieldIds: ['sentence'], maskFieldId: 'sentence', maskTarget: true, requiresInput: true },
  ],
  backTemplate: { fieldIds: ['target', 'def', 'sentence'], showAll: true },
});

const makeNote = () => ({
  id: 'n1',
  notetypeId: 'nt1',
  deckId: 'd1',
  targetWord: 'abandon',
  fields: {
    target: { kind: 'text' as const, value: 'abandon' },
    def: { kind: 'text' as const, value: 'to leave behind' },
    sentence: { kind: 'text' as const, value: 'They decided to abandon the ship.' },
  },
  createdAt: 1,
});

const makeCard = (overrides?: Partial<SrsCard>): SrsCard => ({
  id: 'c1',
  noteId: 'n1',
  deckId: 'd1',
  components: {
    meaning: { type: 'meaning', progress: 0, exploreCount: 0, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
    sound: { type: 'sound', progress: 0, exploreCount: 0, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
    spelling: { type: 'spelling', progress: 0, exploreCount: 0, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
  },
  studyAgainDue: { meaning: null, sound: null, spelling: null },
  createdAt: 1,
  nextDue: now,
  maintenanceMode: false,
  ...overrides,
});

describe('selectNextReview', () => {
  it('returns null when there are no cards', async () => {
    await putCollection({ id: 'c1', languageProfileId: 'lp1', targetLanguage: 'en', name: 'C', defaultStudyConfigId: 'sc1', defaultDeckId: 'd1', defaultNotetypeId: 'nt1', createdAt: 1 });
    await putDeck({ id: 'd1', collectionId: 'c1', parentId: null, name: 'D', order: 0, studyConfigId: 'sc1' });

    const session = await selectNextReview('d1', false, makeConfig(), now, adapter, new Map(), new Map());
    expect(session).toBeNull();
  });

  it('returns the explore component for a fresh card', async () => {
    await putCollection({ id: 'c1', languageProfileId: 'lp1', targetLanguage: 'en', name: 'C', defaultStudyConfigId: 'sc1', defaultDeckId: 'd1', defaultNotetypeId: 'nt1', createdAt: 1 });
    await putDeck({ id: 'd1', collectionId: 'c1', parentId: null, name: 'D', order: 0, studyConfigId: 'sc1' });
    await putNotetype(makeNotetype());
    await putNote(makeNote());
    await putCard(makeCard());

    const session = await selectNextReview('d1', false, makeConfig(), now, adapter, new Map(), new Map());
    expect(session).not.toBeNull();
    expect(session?.componentType).toBe('sound');
    expect(session?.mode).toBe('explore');
    expect(session?.stimulus.type).toBe('ipa');
  });

  it('returns an active component after all components are explored and one is due', async () => {
    await putCollection({ id: 'c1', languageProfileId: 'lp1', targetLanguage: 'en', name: 'C', defaultStudyConfigId: 'sc1', defaultDeckId: 'd1', defaultNotetypeId: 'nt1', createdAt: 1 });
    await putDeck({ id: 'd1', collectionId: 'c1', parentId: null, name: 'D', order: 0, studyConfigId: 'sc1' });
    await putNotetype(makeNotetype());
    await putNote(makeNote());
    await putCard(makeCard());

    // Explore all three components.
    let card: SrsCard | undefined;
    for (const type of ['sound', 'meaning', 'spelling'] as const) {
      const session = await selectNextReview('d1', false, makeConfig(), now, adapter, new Map(), new Map());
      expect(session).not.toBeNull();
      card = applyReview(
        { ...session!, note: makeNote(), notetype: makeNotetype() },
        'remember',
        type === 'spelling' ? 'abandon' : undefined,
        new Date(now),
        makeConfig(),
        adapter,
      ).card;
      await putCard(card);
    }

    // After exploring, review sound once so it becomes due later while the others are still due now.
    const reviewedCard = applyReview(
      { card: card!, note: makeNote(), notetype: makeNotetype(), componentType: 'sound', template: makeNotetype().frontTemplates[0], stimulus: { type: 'ipa', payload: {} }, mode: 'normal', startedAt: Date.now() },
      'remember',
      undefined,
      new Date(now),
      makeConfig(),
      adapter,
    ).card;
    await putCard(reviewedCard);

    const session = await selectNextReview('d1', false, makeConfig(), now, adapter, new Map(), new Map());
    expect(session).not.toBeNull();
    expect(session?.mode).toBe('normal');
  });
});
