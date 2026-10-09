import { registerAnkiStatusSyncHandlers } from './ankiStatusSync';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { listCardSourceTerms, reconcileSrsCardLoss } from '@/features/ankiStatusSync';

jest.mock('@/features/ankiStatusSync', () => ({
  ANKI_STATUS_SYNC_ALARM: 'cell.ankiStatusSync.tick',
  ANKI_SYNC_PERIOD_MINUTES: 5,
  getSyncState: jest.fn(async () => ({})),
  listCardSourceTerms: jest.fn(),
  reconcileSrsCardLoss: jest.fn(),
  runAnkiStatusSync: jest.fn(),
  syncSrsReviewToStatus: jest.fn(),
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

  it('routes the deletion to reconcileSrsCardLoss', async () => {
    (reconcileSrsCardLoss as jest.Mock).mockResolvedValue(undefined);

    const ctx = createMockCtx();
    registerAnkiStatusSyncHandlers(ctx as unknown as Parameters<typeof registerAnkiStatusSyncHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.ANKI_STATUS_SRS_CARD_DELETED);
    const response = await handler?.({ payload: { deckId: 'd1', targetWord: 'abandon' } });

    expect(reconcileSrsCardLoss).toHaveBeenCalledWith('d1', 'abandon');
    expect(response).toEqual({ success: true });
  });

  it('rejects a malformed payload', async () => {
    const ctx = createMockCtx();
    registerAnkiStatusSyncHandlers(ctx as unknown as Parameters<typeof registerAnkiStatusSyncHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.ANKI_STATUS_SRS_CARD_DELETED);
    const response = await handler?.({ payload: { deckId: 'd1' } });

    expect((response as { success: boolean }).success).toBe(false);
    expect(reconcileSrsCardLoss).not.toHaveBeenCalled();
  });
});
