import { registerWordStatusHandlers } from './wordStatus';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import * as wordStatusStore from '@/features/dictionary/services/wordStatusStore';

jest.mock('@/features/dictionary/services/wordStatusStore', () => ({
  setWordStatus: jest.fn(),
  getWordStatus: jest.fn(),
  getWordStatuses: jest.fn(),
  getAllWordStatuses: jest.fn(),
  cycleWordStatus: jest.fn(),
  deleteWordStatus: jest.fn(),
}));

const mockTabsQuery = jest.fn();
const mockTabsSendMessage = jest.fn();
const mockGetAllFrames = jest.fn();

beforeAll(() => {
  (globalThis as unknown as { chrome: typeof chrome }).chrome = {
    tabs: {
      query: mockTabsQuery,
      sendMessage: mockTabsSendMessage,
    },
    webNavigation: {
      getAllFrames: mockGetAllFrames,
    },
    runtime: {},
  } as unknown as typeof chrome;
});

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

async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('WORD_STATUS_SET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (wordStatusStore.setWordStatus as jest.Mock).mockReset();
    mockTabsQuery.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    mockGetAllFrames.mockResolvedValue([{ frameId: 0 }]);
  });

  it('broadcasts WORD_STATUS_CHANGED to other tabs after a successful set', async () => {
    (wordStatusStore.setWordStatus as jest.Mock).mockResolvedValue(undefined);

    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_SET);
    const response = await handler?.({ payload: { tabId: 1, langCode: 'en', term: 'call', status: 'known' } });

    expect(response).toEqual({ success: true });
    await flushPromises();

    expect(mockTabsQuery).toHaveBeenCalledWith({});
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        type: MESSAGE_TYPES.WORD_STATUS_CHANGED,
        payload: { tabId: 1, langCode: 'en', term: 'call', status: 'known' },
      }),
      { frameId: 0 },
    );
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        type: MESSAGE_TYPES.WORD_STATUS_CHANGED,
        payload: { tabId: 1, langCode: 'en', term: 'call', status: 'known' },
      }),
      { frameId: 0 },
    );
    expect(mockTabsSendMessage).not.toHaveBeenCalledWith(
      1,
      expect.anything(),
      expect.anything(),
    );
  });

  it('does not broadcast when setWordStatus fails', async () => {
    (wordStatusStore.setWordStatus as jest.Mock).mockRejectedValue(new Error('idb failed'));

    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_SET);
    const response = await handler?.({ payload: { tabId: 1, langCode: 'en', term: 'call', status: 'known' } });

    expect(response).toEqual({ success: false, error: 'idb failed' });
    await flushPromises();

    expect(mockTabsQuery).not.toHaveBeenCalled();
    expect(mockTabsSendMessage).not.toHaveBeenCalled();
  });
});

describe('WORD_STATUS_LIST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all stored entries for the lang', async () => {
    (wordStatusStore.getAllWordStatuses as jest.Mock).mockResolvedValue([
      { term: 'call', status: 'known', updatedAt: 100 },
      { term: 'pen', status: 'tracking', updatedAt: 200 },
    ]);

    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_LIST);
    const response = await handler?.({ payload: { tabId: 1, langCode: 'en' } });

    expect(response).toEqual({
      success: true,
      data: {
        entries: [
          { term: 'call', status: 'known', updatedAt: 100 },
          { term: 'pen', status: 'tracking', updatedAt: 200 },
        ],
      },
    });
    expect(wordStatusStore.getAllWordStatuses).toHaveBeenCalledWith('en');
  });

  it('rejects a non-2-char langCode', async () => {
    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_LIST);
    const response = await handler?.({ payload: { tabId: 1, langCode: 'zh-hans' } });

    expect(response).toEqual(expect.objectContaining({ success: false }));
    expect(wordStatusStore.getAllWordStatuses).not.toHaveBeenCalled();
  });
});

describe('WORD_STATUS_CYCLE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabsQuery.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockGetAllFrames.mockResolvedValue([{ frameId: 0 }]);
  });

  it('cycles atomically in background and broadcasts CHANGED to other tabs', async () => {
    (wordStatusStore.cycleWordStatus as jest.Mock).mockResolvedValue('known');

    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_CYCLE);
    const response = await handler?.({ payload: { tabId: 1, langCode: 'en', term: 'call' } });

    expect(response).toEqual({ success: true, data: { status: 'known' } });
    expect(wordStatusStore.cycleWordStatus).toHaveBeenCalledWith('en', 'call');
    await flushPromises();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        type: MESSAGE_TYPES.WORD_STATUS_CHANGED,
        payload: { tabId: 1, langCode: 'en', term: 'call', status: 'known' },
      }),
      { frameId: 0 },
    );
  });
});

describe('WORD_STATUS_DELETE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabsQuery.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockGetAllFrames.mockResolvedValue([{ frameId: 0 }]);
  });

  it('deletes the row and broadcasts DELETED to other tabs', async () => {
    (wordStatusStore.deleteWordStatus as jest.Mock).mockResolvedValue(undefined);

    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_DELETE);
    const response = await handler?.({ payload: { tabId: 1, langCode: 'en', term: 'call' } });

    expect(response).toEqual({ success: true });
    expect(wordStatusStore.deleteWordStatus).toHaveBeenCalledWith('en', 'call');
    await flushPromises();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        type: MESSAGE_TYPES.WORD_STATUS_DELETED,
        payload: { tabId: 1, langCode: 'en', term: 'call' },
      }),
      { frameId: 0 },
    );
  });
});
