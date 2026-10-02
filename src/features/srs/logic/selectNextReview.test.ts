import 'fake-indexeddb/auto';
import type { SrsCard, SrsNote, SrsNotetype, SrsReviewSession, SrsStudyConfig, VariantId } from '@/entities/srs/types';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
import { putCollection } from '@/features/srs/repositories/collectionRepository';
import { putDeck } from '@/features/srs/repositories/deckRepository';
import { putNotetype } from '@/features/srs/repositories/notetypeRepository';
import { putNote } from '@/features/srs/repositories/noteRepository';
import { putCard } from '@/features/srs/repositories/cardRepository';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from '@/features/srs/repositories/srsDatabase';
import { createDefaultVariants } from '@/features/srs/lib/defaultVariants';
import { resolveVariantToggles } from '@/features/srs/lib/variantFront';
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
const VARIANTS = createDefaultVariants();

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
    { id: 'sentence', name: 'Sentence', order: 1, type: 'text' },
    { id: 'image', name: 'Image', order: 2, type: 'image' },
    { id: 'wordAudio', name: 'Word audio', order: 3, type: 'audio' },
    { id: 'sentAudio', name: 'Sentence audio', order: 4, type: 'audio' },
  ],
  frontTemplates: [],
  backTemplate: { fieldIds: ['target', 'sentence'], showAll: true },
});

const makeNote = (): SrsNote => ({
  id: 'n1',
  notetypeId: 'nt1',
  deckId: 'd1',
  targetWord: 'abandon',
  fields: {
    sentence: { kind: 'text', value: 'They decided to abandon the ship.' },
    image: { kind: 'image', value: ['https://example.com/pic.png'] },
    wordAudio: { kind: 'audio', value: ['https://example.com/w.mp3'], source: 'local' },
    sentAudio: { kind: 'audio', value: ['https://example.com/s.mp3'], source: 'local' },
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

const sessionOf = (card: SrsCard, variantId: VariantId): SrsReviewSession => {
  const note = makeNote();
  const variant = VARIANTS.find((v) => v.id === variantId)!;
  return {
    card,
    note,
    notetype: makeNotetype(),
    variant,
    variants: VARIANTS,
    toggles: resolveVariantToggles(variant, note),
    stimulus: { type: `variant:${variantId}`, payload: {} },
    mode: 'normal',
    startedAt: Date.now(),
  };
};

async function seed(): Promise<void> {
  await putCollection({ id: 'c1', languageProfileId: 'lp1', targetLanguage: 'en', name: 'C', defaultStudyConfigId: 'sc1', defaultDeckId: 'd1', defaultNotetypeId: 'nt1', createdAt: 1 });
  await putDeck({ id: 'd1', collectionId: 'c1', parentId: null, name: 'D', order: 0, studyConfigId: 'sc1' });
  await putNotetype(makeNotetype());
}

describe('selectNextReview', () => {
  it('returns null when there are no cards', async () => {
    await seed();
    const session = await selectNextReview('d1', false, makeConfig(), now, adapter, new Map(), new Map());
    expect(session).toBeNull();
  });

  it('returns the explore variant for a fresh card', async () => {
    await seed();
    await putNote(makeNote());
    await putCard(makeCard());

    const session = await selectNextReview('d1', false, makeConfig(), now, adapter, new Map(), new Map());
    expect(session).not.toBeNull();
    expect(session?.variant.id).toBe('sound');
    expect(session?.mode).toBe('explore');
    expect(session?.stimulus.type).toBe('variant:sound');
    expect(session?.stimulus.payload.target?.kind).toBe('text');
    expect(session?.stimulus.payload.sentence?.kind).toBe('text');
  });

  it('hides variants whose front material is missing', async () => {
    await seed();
    const textOnly = makeNote();
    delete textOnly.fields.image;
    delete textOnly.fields.wordAudio;
    delete textOnly.fields.sentAudio;
    await putNote(textOnly);
    await putCard(makeCard());

    const first = await selectNextReview('d1', false, makeConfig(), now, adapter, new Map(), new Map());
    expect(first?.variant.id).toBe('sound');

    const card = applyReview({ ...first!, mode: 'explore' }, 'remember', undefined, new Date(now), makeConfig(), adapter).card;
    await putCard(card);

    const next = await selectNextReview('d1', false, makeConfig(), now, adapter, new Map(), new Map());
    expect(next?.variant.id).toBe('sound');
  });

  it('returns an active variant after exploration when it is due', async () => {
    await seed();
    await putNote(makeNote());
    await putCard(makeCard());

    let card: SrsCard | undefined;
    for (const type of ['sound', 'meaning', 'spelling'] as const) {
      const session = await selectNextReview('d1', false, makeConfig(), now, adapter, new Map(), new Map());
      expect(session?.variant.id).toBe(type);
      card = applyReview(
        { ...session!, mode: 'explore' },
        'remember',
        type === 'spelling' ? 'abandon' : undefined,
        new Date(now),
        makeConfig(),
        adapter,
      ).card;
      await putCard(card);
    }

    const reviewedCard = applyReview(sessionOf(card!, 'sound'), 'remember', undefined, new Date(now), makeConfig(), adapter).card;
    await putCard(reviewedCard);

    const session = await selectNextReview('d1', false, makeConfig(), now, adapter, new Map(), new Map());
    expect(session).not.toBeNull();
    expect(session?.mode).toBe('normal');
  });
});
