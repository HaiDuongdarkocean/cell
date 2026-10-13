import { registerWordStatusHandlers } from './wordStatus';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import * as wordStatusStore from '@/features/dictionary/services/wordStatusStore';
import * as wordTrashStore from '@/features/dictionary/services/wordTrashStore';
import { notifyUserMarkedKnown } from '@/features/ankiStatusSync';
import { isFirstStatusesGetForTab, requestRemoteCheck } from '../syncTriggers';

jest.mock('@/features/dictionary/services/wordStatusStore', () => ({
  setWordStatus: jest.fn(),
  setWordStatuses: jest.fn(),
  setWordStatusPos: jest.fn(),
  getWordStatus: jest.fn(),
  getWordStatuses: jest.fn(),
  getAllWordStatuses: jest.fn(),
  getPosStatusRows: jest.fn(async () => []),
  aggregatePosStatus: jest.fn((s: unknown) => s),
  cycleWordStatus: jest.fn(),
  cycleWordStatusPos: jest.fn(),
  deleteWordStatus: jest.fn(),
}));

jest.mock('@/features/dictionary/services/wordTrashStore', () => ({
  trashWordStatus: jest.fn(),
  trashWordStatuses: jest.fn(),
  listWordTrash: jest.fn(async () => []),
  purgeExpiredTrash: jest.fn(async () => undefined),
  restoreWordStatus: jest.fn(async () => 'tracking'),
  restoreWordStatuses: jest.fn(async () => new Map()),
  deleteWordTrash: jest.fn(),
}));

jest.mock('@/features/ankiStatusSync', () => ({
  notifyUserMarkedKnown: jest.fn(),
}));

jest.mock('../syncTriggers', () => ({
  requestRemoteCheck: jest.fn(),
  isFirstStatusesGetForTab: jest.fn(() => true),
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
      })
    );
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        type: MESSAGE_TYPES.WORD_STATUS_CHANGED,
        payload: { tabId: 1, langCode: 'en', term: 'call', status: 'known' },
      })
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

    expect(response).toEqual({ success: false, error: 'The vocabulary action failed: idb failed' });
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
      })
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
      })
    );
  });
});

describe('remote check triggers (SC-12)', () => {
  const mockedCheck = requestRemoteCheck as jest.Mock;
  const mockedFirst = isFirstStatusesGetForTab as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTabsQuery.mockResolvedValue([]);
    mockGetAllFrames.mockResolvedValue([{ frameId: 0 }]);
    (wordStatusStore.setWordStatus as jest.Mock).mockResolvedValue(undefined);
    (wordStatusStore.getWordStatus as jest.Mock).mockResolvedValue('known');
    (wordStatusStore.getWordStatuses as jest.Mock).mockResolvedValue(new Map());
    (wordStatusStore.getAllWordStatuses as jest.Mock).mockResolvedValue([]);
    (wordStatusStore.cycleWordStatus as jest.Mock).mockResolvedValue('known');
    (wordStatusStore.deleteWordStatus as jest.Mock).mockResolvedValue(undefined);
    mockedFirst.mockReturnValue(true);
  });

  const ctx = () => {
    const c = createMockCtx();
    registerWordStatusHandlers(c as unknown as Parameters<typeof registerWordStatusHandlers>[0]);
    return c.handlers;
  };

  it('fires requestRemoteCheck after successful qualifying handlers', async () => {
    const handlers = ctx();
    await handlers.get(MESSAGE_TYPES.WORD_STATUS_SET)!({
      payload: { tabId: 1, langCode: 'en', term: 'call', status: 'known' },
    });
    await handlers.get(MESSAGE_TYPES.WORD_STATUS_GET)!({
      payload: { tabId: 1, langCode: 'en', term: 'call' },
    });
    await handlers.get(MESSAGE_TYPES.WORD_STATUS_LIST)!({
      payload: { tabId: 1, langCode: 'en' },
    });
    await handlers.get(MESSAGE_TYPES.WORD_STATUS_CYCLE)!({
      payload: { tabId: 1, langCode: 'en', term: 'call' },
    });
    await handlers.get(MESSAGE_TYPES.WORD_STATUS_DELETE)!({
      payload: { tabId: 1, langCode: 'en', term: 'call' },
    });
    expect(mockedCheck).toHaveBeenCalledTimes(5);
  });

  it('WORD_STATUSES_GET triggers only when isFirstStatusesGetForTab qualifies', async () => {
    const handlers = ctx();
    await handlers.get(MESSAGE_TYPES.WORD_STATUSES_GET)!({
      payload: { tabId: 9, langCode: 'en', terms: ['call'] },
    });
    expect(mockedCheck).toHaveBeenCalledTimes(1);
    mockedFirst.mockReturnValue(false);
    await handlers.get(MESSAGE_TYPES.WORD_STATUSES_GET)!({
      payload: { tabId: 9, langCode: 'en', terms: ['call'] },
    });
    expect(mockedCheck).toHaveBeenCalledTimes(1);
  });

  it('failed responses never trigger a remote check', async () => {
    (wordStatusStore.setWordStatus as jest.Mock).mockRejectedValue(new Error('idb down'));
    const handlers = ctx();
    const res = await handlers.get(MESSAGE_TYPES.WORD_STATUS_SET)!({
      payload: { tabId: 1, langCode: 'en', term: 'call', status: 'known' },
    });
    expect(res).toEqual(
      expect.objectContaining({ success: false }),
    );
    expect(mockedCheck).not.toHaveBeenCalled();
  });
});

describe('WORD_STATUS_SET_MANY', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabsQuery.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockGetAllFrames.mockResolvedValue([{ frameId: 0 }]);
  });

  it('writes all terms via one store call and broadcasts SET_MANY to other tabs', async () => {
    (wordStatusStore.setWordStatuses as jest.Mock).mockResolvedValue(undefined);

    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_SET_MANY);
    const response = await handler?.({
      payload: { tabId: 1, langCode: 'en', terms: ['a', 'b'], status: 'tracking' },
    });

    expect(response).toEqual({ success: true });
    expect(wordStatusStore.setWordStatuses).toHaveBeenCalledWith(
      'en',
      ['a', 'b'],
      'tracking',
      expect.objectContaining({ source: 'user' }),
    );
    await flushPromises();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        type: MESSAGE_TYPES.WORD_STATUS_SET_MANY,
        payload: { tabId: 1, langCode: 'en', terms: ['a', 'b'], status: 'tracking' },
      })
    );
    expect(mockTabsSendMessage).not.toHaveBeenCalledWith(1, expect.anything(), expect.anything());
    expect(requestRemoteCheck).toHaveBeenCalled();
  });

  it('coerces a legacy learning payload to tracking at the schema boundary', async () => {
    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_SET_MANY);
    const response = await handler?.({
      payload: { tabId: 1, langCode: 'en', terms: ['a', 'b'], status: 'learning' },
    });

    expect(response).toEqual({ success: true });
    expect(wordStatusStore.setWordStatuses).toHaveBeenCalledWith(
      'en',
      ['a', 'b'],
      'tracking',
      expect.objectContaining({ source: 'user' }),
    );
    await flushPromises();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        type: MESSAGE_TYPES.WORD_STATUS_SET_MANY,
        payload: { tabId: 1, langCode: 'en', terms: ['a', 'b'], status: 'tracking' },
      })
    );
  });

  it('notifies known-marked terms for Anki write-back', async () => {
    (wordStatusStore.setWordStatuses as jest.Mock).mockResolvedValue(undefined);
    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_SET_MANY);
    await handler?.({ payload: { tabId: 1, langCode: 'en', terms: ['a', 'b'], status: 'known' } });
    await flushPromises();

    expect(notifyUserMarkedKnown).toHaveBeenCalledWith('en', 'a');
    expect(notifyUserMarkedKnown).toHaveBeenCalledWith('en', 'b');
  });

  it('rejects an empty terms array', async () => {
    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_SET_MANY);
    const response = await handler?.({ payload: { tabId: 1, langCode: 'en', terms: [], status: 'known' } });

    expect((response as { success: boolean }).success).toBe(false);
    expect(wordStatusStore.setWordStatuses).not.toHaveBeenCalled();
  });
});

describe('WORD_STATUS_TRASH_MANY', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabsQuery.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockGetAllFrames.mockResolvedValue([{ frameId: 0 }]);
  });

  it('trashes all terms via one store call and broadcasts TRASH_MANY', async () => {
    (wordTrashStore.trashWordStatuses as jest.Mock).mockResolvedValue(undefined);

    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_TRASH_MANY);
    const response = await handler?.({ payload: { tabId: 1, langCode: 'en', terms: ['a', 'b'] } });

    expect(response).toEqual({ success: true });
    expect(wordTrashStore.trashWordStatuses).toHaveBeenCalledWith('en', ['a', 'b']);
    await flushPromises();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        type: MESSAGE_TYPES.WORD_STATUS_TRASH_MANY,
        payload: { tabId: 1, langCode: 'en', terms: ['a', 'b'] },
      })
    );
    expect(requestRemoteCheck).toHaveBeenCalled();
  });

  it('returns the error and skips broadcast when the store write fails', async () => {
    (wordTrashStore.trashWordStatuses as jest.Mock).mockRejectedValue(new Error('idb failed'));

    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_TRASH_MANY);
    const response = await handler?.({ payload: { tabId: 1, langCode: 'en', terms: ['a'] } });

    expect(response).toEqual({ success: false, error: 'The vocabulary action failed: idb failed' });
    expect(mockTabsSendMessage).not.toHaveBeenCalled();
  });
});

describe('WORD_STATUS_RESTORE_MANY', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabsQuery.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    mockGetAllFrames.mockResolvedValue([{ frameId: 0 }]);
  });

  it('restores all terms and broadcasts RESTORE_MANY', async () => {
    (wordTrashStore.restoreWordStatuses as jest.Mock).mockResolvedValue(
      new Map([['a', 'known'], ['b', 'tracking']]),
    );

    const ctx = createMockCtx();
    registerWordStatusHandlers(ctx as unknown as Parameters<typeof registerWordStatusHandlers>[0]);

    const handler = ctx.handlers.get(MESSAGE_TYPES.WORD_STATUS_RESTORE_MANY);
    const response = await handler?.({ payload: { tabId: 1, langCode: 'en', terms: ['a', 'b'] } });

    expect(response).toEqual({ success: true });
    expect(wordTrashStore.restoreWordStatuses).toHaveBeenCalledWith('en', ['a', 'b']);
    await flushPromises();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        type: MESSAGE_TYPES.WORD_STATUS_RESTORE_MANY,
        payload: { tabId: 1, langCode: 'en', terms: ['a', 'b'] },
      })
    );
    expect(notifyUserMarkedKnown).toHaveBeenCalledWith('en', 'a');
    expect(notifyUserMarkedKnown).not.toHaveBeenCalledWith('en', 'b');
  });
});
