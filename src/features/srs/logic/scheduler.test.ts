import 'fake-indexeddb/auto';
import type { ComponentType, SrsCard, SrsNote, SrsNotetype, SrsStudyConfig, PoolCandidate } from '@/entities/srs/types';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
import { resolvePool } from './resolvePool';
import { pickHighestPriority } from './pickHighestPriority';
import { FUTURE_ISO } from '@/features/srs/lib/helpers';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from '@/features/srs/repositories/srsDatabase';

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

const makeNote = (): SrsNote => ({
  id: 'n1',
  notetypeId: 'nt1',
  deckId: 'd1',
  targetWord: 'abandon',
  fields: { target: { kind: 'text' as const, value: 'abandon' } },
  createdAt: 1,
});

const makeNotetype = (): SrsNotetype => ({
  id: 'nt1',
  collectionId: 'c1',
  name: 'Default',
  targetFieldId: 'target',
  fields: [{ id: 'target', name: 'Target', order: 0, type: 'text' as const }],
  frontTemplates: [{
    id: 't1',
    componentType: 'meaning' as const,
    stimulusType: 'definition' as const,
    fieldIds: ['target'],
    requiresInput: false,
  }],
  backTemplate: { fieldIds: ['target'], showAll: true },
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

const candidate = (type: ComponentType, pool: PoolCandidate['pool'], effectiveDue: string, progress: number): PoolCandidate => ({
  card: makeCard(),
  note: makeNote(),
  notetype: makeNotetype(),
  componentType: type,
  effectiveDue,
  progress,
  pool,
});

describe('resolvePool', () => {
  it('picks explore for the first un-explored component', () => {
    const card = makeCard({
      components: {
        meaning: { type: 'meaning', progress: 0, exploreCount: 1, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
        sound: { type: 'sound', progress: 0, exploreCount: 0, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
        spelling: { type: 'spelling', progress: 0, exploreCount: 1, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
      },
    });
    expect(resolvePool(card, 'sound', now, makeConfig(), adapter)).toBe('explore');
  });

  it('classifies active components due now', () => {
    const card = makeCard({
      components: {
        meaning: { type: 'meaning', progress: 20, exploreCount: 1, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 1 },
        sound: { type: 'sound', progress: 0, exploreCount: 1, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
        spelling: { type: 'spelling', progress: 0, exploreCount: 1, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
      },
    });
    expect(resolvePool(card, 'meaning', now, makeConfig(), adapter)).toBe('active');
  });

  it('classifies study-again components with priority over active', () => {
    const card = makeCard({
      components: {
        meaning: { type: 'meaning', progress: 20, exploreCount: 1, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 1 },
        sound: { type: 'sound', progress: 20, exploreCount: 1, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 1 },
        spelling: { type: 'spelling', progress: 0, exploreCount: 1, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
      },
      studyAgainDue: { meaning: now, sound: null, spelling: null },
    });
    expect(resolvePool(card, 'meaning', now, makeConfig(), adapter)).toBe('studyAgain');
  });

  it('returns null for components not yet due', () => {
    const future = adapter.createEmpty(new Date('2099-01-01T00:00:00.000Z'));
    const card = makeCard({
      components: {
        meaning: { type: 'meaning', progress: 20, exploreCount: 1, fsrsState: future, reviewCount: 1 },
        sound: { type: 'sound', progress: 0, exploreCount: 1, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
        spelling: { type: 'spelling', progress: 0, exploreCount: 1, fsrsState: adapter.createEmpty(new Date(now)), reviewCount: 0 },
      },
    });
    expect(resolvePool(card, 'meaning', now, makeConfig(), adapter)).toBeNull();
  });
});

describe('pickHighestPriority', () => {
  it('selects explore over active', () => {
    const c1 = candidate('sound', 'active', now, 20);
    const c2 = candidate('meaning', 'explore', FUTURE_ISO, 0);
    expect(pickHighestPriority([c1, c2])).toBe(c2);
  });

  it('selects studyAgain over active', () => {
    const c1 = candidate('meaning', 'active', now, 20);
    const c2 = candidate('sound', 'studyAgain', now, 0);
    expect(pickHighestPriority([c1, c2])).toBe(c2);
  });

  it('selects earliest effective due within the same pool', () => {
    const c1 = candidate('meaning', 'active', '2026-09-02T00:00:00.000Z', 20);
    const c2 = candidate('sound', 'active', '2026-09-01T00:00:00.000Z', 20);
    expect(pickHighestPriority([c1, c2])).toBe(c2);
  });

  it('tie-breaks by lower progress', () => {
    const c1 = candidate('meaning', 'active', now, 50);
    const c2 = candidate('sound', 'active', now, 20);
    expect(pickHighestPriority([c1, c2])).toBe(c2);
  });
});
