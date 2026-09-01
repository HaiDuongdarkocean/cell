import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { SrsStudyProvider, useSrsStudy } from './SrsStudyProvider';
import { putCollection } from '@/features/srs/repositories/collectionRepository';
import { putDeck } from '@/features/srs/repositories/deckRepository';
import { putNotetype } from '@/features/srs/repositories/notetypeRepository';
import { putStudyConfig } from '@/features/srs/repositories/studyConfigRepository';
import { putNote } from '@/features/srs/repositories/noteRepository';
import { putCard } from '@/features/srs/repositories/cardRepository';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from '@/features/srs/repositories/srsDatabase';
import { createSrsFsrsAdapter } from '@/features/srs/services/srsFsrsAdapter';
import { STORAGE_KEYS } from '@/shared/config/config';

const settingsStorage: Record<string, unknown> = {};

beforeAll(() => {
  global.chrome = {
    storage: {
      local: {
        get: jest.fn(async (keys: string | string[] | null) => {
          const key = Array.isArray(keys) ? keys[0] : (keys ?? STORAGE_KEYS.SETTINGS);
          return { [key]: settingsStorage[key] };
        }),
        set: jest.fn(async (obj: Record<string, unknown>) => {
          Object.assign(settingsStorage, obj);
        }),
      },
    },
  } as unknown as typeof chrome;
});

beforeEach(() => {
  Object.keys(settingsStorage).forEach((k) => delete settingsStorage[k]);
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

const adapter = createSrsFsrsAdapter();

const notetype = {
  id: 'nt1',
  collectionId: 'c1',
  name: 'Test',
  targetFieldId: 'target',
  fields: [{ id: 'target', name: 'Target', order: 0, type: 'text' as const }],
  frontTemplates: [
    { id: 't1', componentType: 'sound' as const, stimulusType: 'ipa' as const, fieldIds: ['target'], requiresInput: false },
  ],
  backTemplate: { fieldIds: ['target'], showAll: true },
};

const studyConfig = {
  id: 'sc1',
  targetThreshold: 90,
  learningPath: { stages: ['sound', 'meaning', 'spelling'] as const, progressionMode: 'parallel' as const, minExplores: 1 },
  progressConstants: { rememberGainBase: 20, rememberGainMin: 1, forgetPenaltyBase: 12, forgetPenaltyStep: 0.1 },
};

function TestHarness() {
  const { ready, session, finished, start } = useSrsStudy();

  useEffect(() => {
    start();
  }, [start]);

  if (!ready) return <div data-cell-id="loading">loading</div>;
  if (finished) return <div data-cell-id="finished">finished</div>;
  if (session) return <div data-cell-id="session">{session.componentType}</div>;
  return <div data-cell-id="empty">empty</div>;
}

async function seedCollectionAndDeck() {
  await putCollection({
    id: 'c1',
    languageProfileId: 'lp1',
    targetLanguage: 'en',
    name: 'C',
    defaultStudyConfigId: 'sc1',
    defaultDeckId: 'd1',
    defaultNotetypeId: 'nt1',
    createdAt: 1,
  });
  await putDeck({ id: 'd1', collectionId: 'c1', parentId: null, name: 'D', order: 0, studyConfigId: 'sc1' });
  await putNotetype(notetype);
  await putStudyConfig(studyConfig);
}

function seedSettings() {
  settingsStorage[STORAGE_KEYS.SETTINGS] = {
    schemaVersion: 27,
    activeProfileId: 'lp1',
    languageProfiles: [
      { id: 'lp1', target: 'en', native: '', name: 'English', order: 1, resourceIds: [] },
    ],
    srs: {
      activeLanguageProfileId: 'lp1',
      activeCollectionId: 'c1',
      activeDeckId: 'd1',
      activeNotetypeId: 'nt1',
      defaultStudyConfigId: 'sc1',
      dataLifecycle: { reviewEventMaxAgeDays: 365, reviewEventMaxCount: 10000, audioQuotaMb: 50, imageQuotaMb: 50 },
    },
  };
}

describe('SrsStudyProvider', () => {
  it('bootstraps on first run and finishes when there are no cards', async () => {
    seedSettings();

    render(
      <SrsStudyProvider>
        <TestHarness />
      </SrsStudyProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('finished')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('loads an existing due card and applies a review', async () => {
    seedSettings();
    await seedCollectionAndDeck();
    await putNote({
      id: 'n1',
      notetypeId: 'nt1',
      deckId: 'd1',
      targetWord: 'abandon',
      fields: { target: { kind: 'text' as const, value: 'abandon' } },
      createdAt: 1,
    });
    await putCard({
      id: 'c1',
      noteId: 'n1',
      deckId: 'd1',
      components: {
        meaning: { type: 'meaning', progress: 0, exploreCount: 1, fsrsState: adapter.createEmpty(new Date('3000-01-01T00:00:00.000Z')), reviewCount: 0 },
        sound: { type: 'sound', progress: 0, exploreCount: 1, fsrsState: adapter.createEmpty(new Date('1900-01-01T00:00:00.000Z')), reviewCount: 0 },
        spelling: { type: 'spelling', progress: 0, exploreCount: 1, fsrsState: adapter.createEmpty(new Date('3000-01-01T00:00:00.000Z')), reviewCount: 0 },
      },
      studyAgainDue: { meaning: null, sound: null, spelling: null },
      createdAt: 1,
      nextDue: '1900-01-01T00:00:00.000Z',
      maintenanceMode: false,
    });

    function ApplyHarness() {
      const { ready, session, finished, error, start, submit } = useSrsStudy();

      useEffect(() => {
        start();
      }, [start]);

      if (error) return <div data-cell-id="error">{error}</div>;
      if (!ready || !session) return <div data-cell-id={finished ? 'finished' : 'loading'}>{finished ? 'finished' : 'loading'}</div>;
      return (
        <button data-cell-id="session" onClick={() => submit('remember')}>
          {session.componentType}
        </button>
      );
    }

    render(
      <SrsStudyProvider>
        <ApplyHarness />
      </SrsStudyProvider>,
    );

    const button = await waitFor(() => screen.getByTestId('session'), { timeout: 3000 });
    expect(button.textContent).toBe('sound');

    await act(async () => {
      button.click();
    });

    await waitFor(() => expect(screen.getByTestId('finished')).toBeInTheDocument(), { timeout: 3000 });
  });
});
