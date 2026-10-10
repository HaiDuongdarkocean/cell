import { registerSrsHandlers } from './srs';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { getAllCollections } from '@/features/srs/repositories/collectionRepository';
import { getDecksByCollection } from '@/features/srs/repositories/deckRepository';
import { getNotesByDeck } from '@/features/srs/repositories/noteRepository';
import { getAllLinks, getLinksByTerm } from '@/features/ankiStatusSync/repositories/statusSyncStorage';
import type { SrsDeck, SrsNote } from '@/entities/srs/types';
import type { AnkiCardLink } from '@/entities/ankiStatusSync';

jest.mock('@/features/srs/services/addNoteFromMessage', () => ({
  addNoteFromMessage: jest.fn(),
}));
jest.mock('@/features/srs/services/firstRunService', () => ({
  ensureFirstRun: jest.fn(),
}));
jest.mock('@/features/srs/repositories/collectionRepository', () => ({
  getCollection: jest.fn(),
  getAllCollections: jest.fn(),
}));
jest.mock('@/features/srs/repositories/deckRepository', () => ({
  getDecksByCollection: jest.fn(),
}));
jest.mock('@/features/srs/repositories/noteRepository', () => ({
  getNotesByDeck: jest.fn(),
}));
jest.mock('@/features/srs/repositories/notetypeRepository', () => ({
  getNotetypesByCollection: jest.fn(),
}));
jest.mock('@/features/ankiStatusSync/repositories/statusSyncStorage', () => ({
  getLinksByTerm: jest.fn(),
  getAllLinks: jest.fn(),
}));
jest.mock('@/features/dictionary', () => ({
  normalizeTerm: (term: string) => term.trim().normalize('NFC').toLowerCase(),
}));

const mockGetAllCollections = jest.mocked(getAllCollections);
const mockGetDecksByCollection = jest.mocked(getDecksByCollection);
const mockGetNotesByDeck = jest.mocked(getNotesByDeck);
const mockGetLinksByTerm = jest.mocked(getLinksByTerm);
const mockGetAllLinks = jest.mocked(getAllLinks);

function createMockCtx(): {
  handlers: Map<string, (request: { payload: unknown }) => Promise<unknown>>;
  on: (type: string, handler: (request: { payload: unknown }) => Promise<unknown>) => void;
} {
  const handlers = new Map<string, (request: { payload: unknown }) => Promise<unknown>>();
  return {
    handlers,
    on: (type, handler) => {
      handlers.set(type, handler);
    },
  };
}

function makeDeck(id: string, collectionId = 'col-en'): SrsDeck {
  return {
    id,
    collectionId,
    parentId: null,
    name: id,
    order: 0,
    studyConfigId: 'sc',
  };
}

function makeNote(id: string, deckId: string, targetWord: string): SrsNote {
  return {
    id,
    notetypeId: 'nt',
    deckId,
    targetWord,
    fields: {},
    createdAt: 0,
  };
}

function makeLink(cardId: number, term: string, langCode = 'en'): AnkiCardLink {
  return { cardId, term, langCode, queue: 0, ivl: 0, mod: 0 };
}

describe('SRS_TERM_CARDS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllCollections.mockResolvedValue([
      { id: 'col-en', languageProfileId: 'p1', targetLanguage: 'en', name: 'EN', defaultStudyConfigId: 'sc', defaultDeckId: 'd1', defaultNotetypeId: 'nt', createdAt: 0 },
      { id: 'col-ja', languageProfileId: 'p2', targetLanguage: 'ja', name: 'JA', defaultStudyConfigId: 'sc', defaultDeckId: 'dj', defaultNotetypeId: 'nt', createdAt: 0 },
    ]);
    mockGetDecksByCollection.mockImplementation(async (collectionId) =>
      collectionId === 'col-en' ? [makeDeck('d1'), makeDeck('d2')] : [makeDeck('dj', 'col-ja')]);
    mockGetLinksByTerm.mockResolvedValue([]);
  });

  it('counts normalized note matches per language and reports matching deck ids', async () => {
    mockGetNotesByDeck.mockImplementation(async (deckId) => {
      if (deckId === 'd1') return [makeNote('n1', 'd1', 'Hello'), makeNote('n2', 'd1', 'other')];
      if (deckId === 'd2') return [makeNote('n3', 'd2', ' hello ')];
      return [makeNote('nj', 'dj', 'hello')];
    });
    mockGetLinksByTerm.mockResolvedValue([
      makeLink(1, 'hello'),
      makeLink(2, 'hello', 'ja'),
    ]);

    const ctx = createMockCtx();
    registerSrsHandlers(ctx as unknown as Parameters<typeof registerSrsHandlers>[0]);
    const handler = ctx.handlers.get(MESSAGE_TYPES.SRS_TERM_CARDS);
    const response = await handler?.({ payload: { langCode: 'en', term: 'HELLO' } });

    expect(mockGetLinksByTerm).toHaveBeenCalledWith('hello');
    expect(response).toEqual({
      success: true,
      data: { count: 3, deckIds: ['d1', 'd2'] },
    });
  });

  it('returns zero counts when nothing matches', async () => {
    mockGetNotesByDeck.mockResolvedValue([]);

    const ctx = createMockCtx();
    registerSrsHandlers(ctx as unknown as Parameters<typeof registerSrsHandlers>[0]);
    const handler = ctx.handlers.get(MESSAGE_TYPES.SRS_TERM_CARDS);
    const response = await handler?.({ payload: { langCode: 'en', term: 'hello' } });

    expect(response).toEqual({ success: true, data: { count: 0, deckIds: [] } });
  });

  it('rejects a malformed payload', async () => {
    const ctx = createMockCtx();
    registerSrsHandlers(ctx as unknown as Parameters<typeof registerSrsHandlers>[0]);
    const handler = ctx.handlers.get(MESSAGE_TYPES.SRS_TERM_CARDS);
    const response = await handler?.({ payload: { langCode: 'en' } });

    expect((response as { success: boolean }).success).toBe(false);
    expect(mockGetAllCollections).not.toHaveBeenCalled();
  });
});

describe('SRS_CARDS_TERMS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllCollections.mockResolvedValue([
      { id: 'col-en', languageProfileId: 'p1', targetLanguage: 'en', name: 'EN', defaultStudyConfigId: 'sc', defaultDeckId: 'd1', defaultNotetypeId: 'nt', createdAt: 0 },
      { id: 'col-ja', languageProfileId: 'p2', targetLanguage: 'ja', name: 'JA', defaultStudyConfigId: 'sc', defaultDeckId: 'dj', defaultNotetypeId: 'nt', createdAt: 0 },
    ]);
    mockGetDecksByCollection.mockImplementation(async (collectionId) =>
      collectionId === 'col-en' ? [makeDeck('d1'), makeDeck('d2')] : [makeDeck('dj', 'col-ja')]);
    mockGetAllLinks.mockResolvedValue([]);
  });

  it('unions normalized Ocean note terms and lang-matching Anki link terms', async () => {
    mockGetNotesByDeck.mockImplementation(async (deckId) => {
      if (deckId === 'd1') return [makeNote('n1', 'd1', 'Hello'), makeNote('n2', 'd1', 'other')];
      if (deckId === 'd2') return [makeNote('n3', 'd2', ' hello ')];
      return [makeNote('nj', 'dj', 'hello')];
    });
    mockGetAllLinks.mockResolvedValue([
      makeLink(1, 'linked'),
      makeLink(2, 'foreign', 'ja'),
    ]);

    const ctx = createMockCtx();
    registerSrsHandlers(ctx as unknown as Parameters<typeof registerSrsHandlers>[0]);
    const handler = ctx.handlers.get(MESSAGE_TYPES.SRS_CARDS_TERMS);
    const response = await handler?.({ payload: { langCode: 'en' } });

    expect(response).toEqual({
      success: true,
      data: { terms: expect.arrayContaining(['hello', 'other', 'linked']) },
    });
    const terms = (response as { data: { terms: string[] } }).data.terms;
    expect(terms).toHaveLength(3);
    expect(terms).not.toContain('foreign');
  });

  it('returns an empty set for a language with no cards', async () => {
    mockGetNotesByDeck.mockResolvedValue([]);

    const ctx = createMockCtx();
    registerSrsHandlers(ctx as unknown as Parameters<typeof registerSrsHandlers>[0]);
    const handler = ctx.handlers.get(MESSAGE_TYPES.SRS_CARDS_TERMS);
    const response = await handler?.({ payload: { langCode: 'en' } });

    expect(response).toEqual({ success: true, data: { terms: [] } });
  });

  it('rejects a malformed payload', async () => {
    const ctx = createMockCtx();
    registerSrsHandlers(ctx as unknown as Parameters<typeof registerSrsHandlers>[0]);
    const handler = ctx.handlers.get(MESSAGE_TYPES.SRS_CARDS_TERMS);
    const response = await handler?.({ payload: {} });

    expect((response as { success: boolean }).success).toBe(false);
    expect(mockGetAllCollections).not.toHaveBeenCalled();
  });
});

describe('SRS_OPEN_STUDY_PAGE', () => {
  it('appends the term filter to the study page url', async () => {
    const create = jest.fn(async () => ({ id: 7 }));
    const getURL = jest.fn((p: string) => `chrome-extension://ext/${p}`);
    (globalThis as Record<string, unknown>).chrome = {
      ...(globalThis.chrome as object | undefined),
      tabs: { create },
      runtime: { ...(globalThis.chrome?.runtime as object | undefined), getURL },
    };

    const ctx = createMockCtx();
    registerSrsHandlers(ctx as unknown as Parameters<typeof registerSrsHandlers>[0]);
    const handler = ctx.handlers.get(MESSAGE_TYPES.SRS_OPEN_STUDY_PAGE);
    const response = await handler?.({ payload: { term: 'hello world' } });

    expect(response).toEqual({ success: true, data: { tabId: 7 } });
    expect(create).toHaveBeenCalledWith({
      url: 'chrome-extension://ext/src/entrypoints/srs-study/index.html?term=hello+world',
    });
  });
});
