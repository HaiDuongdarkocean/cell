// addNoteFromMessage — REQ-4/AC-5: a successful SRS note creation flags the
// term 'learning' via the system writer; failures and user-set base statuses
// are never overridden by that write.

import 'fake-indexeddb/auto';
import type { SrsNotetype, SrsStudyConfig } from '@/entities/srs/types';

import { addNoteFromMessage } from './addNoteFromMessage';
import type { SrsAddNoteMessageInput } from './addNoteFromMessage';
import { SrsError } from '@/features/srs/lib/srsError';
import { putCollection } from '@/features/srs/repositories/collectionRepository';
import { putDeck } from '@/features/srs/repositories/deckRepository';
import { putNotetype } from '@/features/srs/repositories/notetypeRepository';
import { putStudyConfig } from '@/features/srs/repositories/studyConfigRepository';
import {
  closeAllSrsDBs,
  clearAllSrsStores,
  getSrsDbName,
  deleteSrsDB,
} from '@/features/srs/repositories/srsDatabase';
import { getWordStatus, setWordStatusFromSync, closeAllDBs, clearAllStores } from '@/features/dictionary';

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
  storageLocalGetMock.mockResolvedValue({});
});

beforeEach(async () => {
  closeAllSrsDBs();
  closeAllDBs();
  await clearAllSrsStores();
  await clearAllStores('en');
  await seedSrsGraph();
});

afterEach(() => {
  closeAllSrsDBs();
  closeAllDBs();
});

afterAll(async () => {
  delete (global as { chrome?: unknown }).chrome;
  await deleteSrsDB(await getSrsDbName());
});

async function seedSrsGraph(): Promise<void> {
  await putCollection({
    id: 'col1',
    languageProfileId: 'lp1',
    targetLanguage: 'en',
    name: 'My SRS',
    defaultStudyConfigId: 'sc1',
    defaultDeckId: 'd1',
    defaultNotetypeId: 'nt1',
    createdAt: 1,
  });
  await putDeck({
    id: 'd1',
    collectionId: 'col1',
    parentId: null,
    name: 'Default',
    order: 0,
    studyConfigId: 'sc1',
  });
  await putNotetype(makeNotetype());
  await putStudyConfig(makeConfig());
}

const makeNotetype = (): SrsNotetype => ({
  id: 'nt1',
  collectionId: 'col1',
  name: 'Default',
  targetFieldId: 'target',
  fields: [{ id: 'target', name: 'Target', order: 0, type: 'text' as const }],
  frontTemplates: [],
  backTemplate: { fieldIds: ['target'], showAll: true },
});

const makeConfig = (): SrsStudyConfig => ({
  id: 'sc1',
  targetThreshold: 90,
  learningPath: { stages: ['sound', 'meaning', 'spelling'], progressionMode: 'parallel', minExplores: 1 },
  progressConstants: { rememberGainBase: 20, rememberGainMin: 1, forgetPenaltyBase: 12, forgetPenaltyStep: 0.1 },
});

const input = (targetWord: string): SrsAddNoteMessageInput => ({
  targetLanguage: 'en',
  collectionId: 'col1',
  deckId: 'd1',
  notetypeId: 'nt1',
  targetWord,
  fields: { target: { kind: 'text', value: targetWord } },
});

describe('addNoteFromMessage → learning flag (REQ-4 / AC-5)', () => {
  it('flags the normalized term learning after a successful note add', async () => {
    const result = await addNoteFromMessage(input('  Abandon '));

    expect(result.noteId).toBeTruthy();
    expect(await getWordStatus('en', 'abandon')).toBe('learning');
  });

  it('writes no status when note creation fails', async () => {
    await addNoteFromMessage(input('abandon'));
    await clearAllStores('en');

    await expect(addNoteFromMessage(input('abandon'))).rejects.toThrow(SrsError);

    expect(await getWordStatus('en', 'abandon')).toBe('unknown');
  });

  it('does not overwrite known or ignore terms — arbitration wins', async () => {
    await setWordStatusFromSync('en', 'cat', 'known', { source: 'srs', sourceAt: Date.now() });
    await setWordStatusFromSync('en', 'dog', 'ignore', { source: 'srs', sourceAt: Date.now() });

    await addNoteFromMessage(input('cat'));
    await addNoteFromMessage(input('dog'));

    expect(await getWordStatus('en', 'cat')).toBe('known');
    expect(await getWordStatus('en', 'dog')).toBe('ignore');
  });
});
