import 'fake-indexeddb/auto';
import type { SrsAudioAsset, SrsImageAsset, SrsReviewRecord, SrsFsrsSerializedState } from '@/entities/srs/types';
import { putAudioAsset, getAudioAsset, deleteAudioAsset, getAudioAssetsByNote } from './audioAssetRepository';
import { putImageAsset, getImageAsset, getImageAssetsByNote } from './imageAssetRepository';
import { putReviewEvent, getReviewEvent, getReviewEventsByCard, getReviewEventsByTimestampRange } from './reviewEventRepository';
import { deleteCollectionCascade } from './deleteCascade';
import { putCollection } from './collectionRepository';
import { putDeck } from './deckRepository';
import { putNotetype } from './notetypeRepository';
import { putNote } from './noteRepository';
import { putCard } from './cardRepository';
import { closeAllSrsDBs, clearAllSrsStores, getSrsDbName, deleteSrsDB } from './srsDatabase';
import { SrsError } from '@/features/srs/lib/srsError';

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

const makeAudio = (id: string, noteId: string): SrsAudioAsset => ({
  id,
  noteId,
  fieldId: 'f1',
  source: 'tts',
  mimeType: 'audio/mpeg',
  bytes: new ArrayBuffer(4),
  size: 4,
  lastAccessed: 1,
  createdAt: 1,
});

const makeImage = (id: string, noteId: string): SrsImageAsset => ({
  id,
  noteId,
  fieldId: 'f2',
  mimeType: 'image/png',
  bytes: new ArrayBuffer(4),
  size: 4,
  lastAccessed: 1,
  createdAt: 1,
});

const emptyFsrs = (): SrsFsrsSerializedState => ({
  version: 1,
  due: '2025-01-01T00:00:00.000Z',
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  reps: 0,
  lapses: 0,
  learningSteps: 0,
  state: 0,
});

const makeReview = (id: string, cardId: string): SrsReviewRecord => ({
  id,
  cardId,
  noteId: 'n1',
  notetypeId: 'nt1',
  componentType: 'meaning',
  templateId: 't1',
  stimulusType: 'definition',
  startedAt: 1,
  answeredAt: 1000,
  judgment: 'remember',
  isStudyAgain: false,
  resultingProgress: 20,
  resultingFsrsState: emptyFsrs(),
});

describe('audioAssetRepository', () => {
  it('stores and retrieves an audio asset', async () => {
    const a = makeAudio('a1', 'n1');
    await putAudioAsset(a);
    const found = await getAudioAsset('a1');
    expect(found).toEqual(a);
  });

  it('throws NOT_FOUND for missing audio asset', async () => {
    await expect(getAudioAsset('missing')).rejects.toThrow(SrsError);
  });

  it('lists audio assets by note', async () => {
    const a1 = makeAudio('a1', 'n1');
    const a2 = makeAudio('a2', 'n1');
    const a3 = makeAudio('a3', 'n2');
    await putAudioAsset(a1);
    await putAudioAsset(a2);
    await putAudioAsset(a3);
    const found = await getAudioAssetsByNote('n1');
    expect(found.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('deletes an audio asset', async () => {
    const a = makeAudio('a1', 'n1');
    await putAudioAsset(a);
    await deleteAudioAsset('a1');
    await expect(getAudioAsset('a1')).rejects.toThrow(SrsError);
  });
});

describe('imageAssetRepository', () => {
  it('stores and retrieves an image asset', async () => {
    const img = makeImage('i1', 'n1');
    await putImageAsset(img);
    const found = await getImageAsset('i1');
    expect(found).toEqual(img);
  });

  it('lists image assets by note', async () => {
    const i1 = makeImage('i1', 'n1');
    const i2 = makeImage('i2', 'n2');
    await putImageAsset(i1);
    await putImageAsset(i2);
    const found = await getImageAssetsByNote('n2');
    expect(found.map((i) => i.id)).toEqual(['i2']);
  });
});

describe('reviewEventRepository', () => {
  it('stores and retrieves a review event', async () => {
    const r = makeReview('r1', 'c1');
    await putReviewEvent(r);
    const found = await getReviewEvent('r1');
    expect(found).toEqual(r);
  });

  it('lists review events by card', async () => {
    const r1 = makeReview('r1', 'c1');
    const r2 = makeReview('r2', 'c1');
    const r3 = makeReview('r3', 'c2');
    await putReviewEvent(r1);
    await putReviewEvent(r2);
    await putReviewEvent(r3);
    const found = await getReviewEventsByCard('c1');
    expect(found.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('queries review events by timestamp range', async () => {
    const r1 = { ...makeReview('r1', 'c1'), answeredAt: 100 };
    const r2 = { ...makeReview('r2', 'c1'), answeredAt: 500 };
    const r3 = { ...makeReview('r3', 'c1'), answeredAt: 1000 };
    await putReviewEvent(r1);
    await putReviewEvent(r2);
    await putReviewEvent(r3);
    const found = await getReviewEventsByTimestampRange(200, 900);
    expect(found.map((r) => r.id)).toEqual(['r2']);
  });
});

describe('deleteCascade', () => {
  it('removes collection and all children', async () => {
    const collection = {
      id: 'col1',
      languageProfileId: 'lp1',
      targetLanguage: 'en',
      name: 'English',
      defaultStudyConfigId: 'sc1',
      defaultDeckId: 'd1',
      defaultNotetypeId: 'nt1',
      createdAt: 1,
    };
    await putCollection(collection);

    await putDeck({
      id: 'd1',
      collectionId: 'col1',
      parentId: null,
      name: 'Root',
      order: 0,
      studyConfigId: 'sc1',
    });

    const notetype: import('@/entities/srs/types').SrsNotetype = {
      id: 'nt1',
      collectionId: 'col1',
      name: 'Default',
      targetFieldId: 'f-text',
      fields: [{ id: 'f-text', name: 'Word', order: 0, type: 'text' }],
      frontTemplates: [{
        id: 't1',
        componentType: 'meaning',
        stimulusType: 'definition',
        fieldIds: ['f-text'],
        requiresInput: false,
      }],
      backTemplate: { fieldIds: ['f-text'], showAll: true },
    };
    await putNotetype(notetype);

    const note: import('@/entities/srs/types').SrsNote = {
      id: 'n1',
      notetypeId: 'nt1',
      deckId: 'd1',
      targetWord: 'abandon',
      fields: { 'f-text': { kind: 'text', value: 'abandon' } },
      createdAt: 1,
    };
    await putNote(note);

    const card: import('@/entities/srs/types').SrsCard = {
      id: 'c1',
      noteId: 'n1',
      deckId: 'd1',
      components: {
        meaning: { type: 'meaning', progress: 0, exploreCount: 0, fsrsState: emptyFsrs(), reviewCount: 0 },
        sound: { type: 'sound', progress: 0, exploreCount: 0, fsrsState: emptyFsrs(), reviewCount: 0 },
        spelling: { type: 'spelling', progress: 0, exploreCount: 0, fsrsState: emptyFsrs(), reviewCount: 0 },
      },
      studyAgainDue: { meaning: null, sound: null, spelling: null },
      createdAt: 1,
      nextDue: '2025-01-01T00:00:00.000Z',
      maintenanceMode: false,
    };
    await putCard(card);

    const audio = makeAudio('a1', 'n1');
    const image = makeImage('i1', 'n1');
    const review = makeReview('r1', 'c1');
    await putAudioAsset(audio);
    await putImageAsset(image);
    await putReviewEvent(review);

    await deleteCollectionCascade('col1');

    await expect(getAudioAsset('a1')).rejects.toThrow(SrsError);
    await expect(getImageAsset('i1')).rejects.toThrow(SrsError);
    await expect(getReviewEvent('r1')).rejects.toThrow(SrsError);
  });
});
