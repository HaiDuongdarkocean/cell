import { registerWordStatusHandlers } from './wordStatus';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import * as wordStatusStore from '@/features/dictionary/services/wordStatusStore';

jest.mock('@/features/dictionary/services/wordStatusStore', () => ({
  setWordStatus: jest.fn(),
  getWordStatus: jest.fn(),
  getWordStatuses: jest.fn(),
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
