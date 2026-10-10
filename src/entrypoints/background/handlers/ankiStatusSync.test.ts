import { registerAnkiStatusSyncHandlers } from './ankiStatusSync';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { listCardSourceTerms, srsDeckLangCode } from '@/features/ankiStatusSync';
import { broadcastSrsCardsChanged } from './srsCardsBroadcast';

jest.mock('@/features/ankiStatusSync', () => ({
  ANKI_STATUS_SYNC_ALARM: 'cell.ankiStatusSync.tick',
  ANKI_SYNC_PERIOD_MINUTES: 5,
  getSyncState: jest.fn(async () => ({})),
  listCardSourceTerms: jest.fn(),
  srsDeckLangCode: jest.fn(),
  runAnkiStatusSync: jest.fn(),
  syncSrsReviewToStatus: jest.fn(),
}));

jest.mock('./srsCardsBroadcast', () => ({
  broadcastSrsCardsChanged: jest.fn(),
}));

jest.mock('@/features/srs', () => ({
  getCard: jest.fn(),
  getNote: jest.fn(),
}));

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

describe('ANKI_STATUS_CARD_TERMS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns per-source term lists for the language', async () => {
    (listCardSourceTerms as jest.Mock).mockResolvedValue({
      anki: ['alpha'],
      srs: ['beta', 'alpha'],
    });

    const ctx = createMockCtx();
    registerAnkiStatusSyncHandlers(ctx as unknown as Parameters<typeof registerAnkiStatusSyncHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.ANKI_STATUS_CARD_TERMS);
    const response = await handler?.({ payload: { langCode: 'en' } });

    expect(listCardSourceTerms).toHaveBeenCalledWith('en');
    expect(response).toEqual({
      success: true,
      data: { anki: ['alpha'], srs: ['beta', 'alpha'] },
    });
  });

  it('rejects a malformed payload', async () => {
    const ctx = createMockCtx();
    registerAnkiStatusSyncHandlers(ctx as unknown as Parameters<typeof registerAnkiStatusSyncHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.ANKI_STATUS_CARD_TERMS);
    const response = await handler?.({ payload: { langCode: 'eng' } });

    expect((response as { success: boolean }).success).toBe(false);
    expect(listCardSourceTerms).not.toHaveBeenCalled();
  });
});

describe('ANKI_STATUS_SRS_CARD_DELETED', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('repaints the hasCard layer via SRS_CARDS_CHANGED — status stays untouched', async () => {
    (srsDeckLangCode as jest.Mock).mockResolvedValue('en');

    const ctx = createMockCtx();
    registerAnkiStatusSyncHandlers(ctx as unknown as Parameters<typeof registerAnkiStatusSyncHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.ANKI_STATUS_SRS_CARD_DELETED);
    const response = await handler?.({ payload: { deckId: 'd1', targetWord: 'abandon' } });

    expect(srsDeckLangCode).toHaveBeenCalledWith('d1');
    expect(broadcastSrsCardsChanged).toHaveBeenCalledWith(expect.anything(), 'en');
    expect(response).toEqual({ success: true });
  });

  it('skips the broadcast when the deck language cannot be resolved', async () => {
    (srsDeckLangCode as jest.Mock).mockResolvedValue(null);

    const ctx = createMockCtx();
    registerAnkiStatusSyncHandlers(ctx as unknown as Parameters<typeof registerAnkiStatusSyncHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.ANKI_STATUS_SRS_CARD_DELETED);
    const response = await handler?.({ payload: { deckId: 'd1', targetWord: 'abandon' } });

    expect(broadcastSrsCardsChanged).not.toHaveBeenCalled();
    expect(response).toEqual({ success: true });
  });

  it('rejects a malformed payload', async () => {
    const ctx = createMockCtx();
    registerAnkiStatusSyncHandlers(ctx as unknown as Parameters<typeof registerAnkiStatusSyncHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.ANKI_STATUS_SRS_CARD_DELETED);
    const response = await handler?.({ payload: { deckId: 'd1' } });

    expect((response as { success: boolean }).success).toBe(false);
    expect(srsDeckLangCode).not.toHaveBeenCalled();
    expect(broadcastSrsCardsChanged).not.toHaveBeenCalled();
  });
});
