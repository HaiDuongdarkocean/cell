import { registerMiningQueueHandlers } from './miningQueue';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import * as repository from '@/features/miningQueue/services/miningQueueRepository';
import type { MiningQueueItem, MiningQueueRow } from '@/entities/miningQueue';

jest.mock('@/features/miningQueue/services/miningQueueRepository', () => ({
  addQueueItem: jest.fn(),
  listQueueRows: jest.fn(),
  getQueueItem: jest.fn(),
  removeQueueItem: jest.fn(),
}));

jest.mock('@/shared/lib/chrome-apis/tabs', () => ({
  queryTabs: jest.fn(async () => [{ id: 7 }]),
  sendMessageToAllFramesInTab: jest.fn(async () => undefined),
}));

import { queryTabs, sendMessageToAllFramesInTab } from '@/shared/lib/chrome-apis/tabs';

const addQueueItemMock = repository.addQueueItem as jest.Mock;
const listQueueRowsMock = repository.listQueueRows as jest.Mock;
const getQueueItemMock = repository.getQueueItem as jest.Mock;
const removeQueueItemMock = repository.removeQueueItem as jest.Mock;
const queryTabsMock = queryTabs as jest.Mock;
const sendAllFramesMock = sendMessageToAllFramesInTab as jest.Mock;

type Handler = (request: { payload: unknown }) => Promise<unknown>;

function createMockCtx(): {
  handlers: Map<string, Handler>;
  broadcast: jest.Mock;
  on: (type: string, handler: Handler) => void;
  messageBus: { broadcast: jest.Mock };
} {
  const handlers = new Map<string, Handler>();
  const broadcast = jest.fn();
  return {
    handlers,
    broadcast,
    messageBus: { broadcast },
    on: (type, handler) => {
      handlers.set(type, handler);
    },
  };
}

const INPUT = {
  kind: 'term',
  term: '猫',
  langCode: 'ja',
  sentence: '猫が好き',
} as const;

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('miningQueue handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryTabsMock.mockResolvedValue([{ id: 7 }]);
    sendAllFramesMock.mockResolvedValue(undefined);
  });

  it('QUEUE_ADD persists the item and broadcasts QUEUE_CHANGED', async () => {
    const ctx = createMockCtx();
    registerMiningQueueHandlers(ctx as never);
    const item = { id: 'q1', dedupeKey: 'k', createdAt: 1, ...INPUT } as MiningQueueItem;
    addQueueItemMock.mockResolvedValue({ item, deduped: false });

    const res = await ctx.handlers.get(MESSAGE_TYPES.QUEUE_ADD)!({
      payload: { tabId: -1, item: INPUT },
    });
    expect(res).toEqual({ success: true, data: { id: 'q1', deduped: false } });

    await flush();
    expect(sendAllFramesMock).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ type: MESSAGE_TYPES.QUEUE_CHANGED }),
    );
    expect(ctx.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: MESSAGE_TYPES.QUEUE_CHANGED }),
    );
  });

  it('QUEUE_ADD returns a failure response on store errors', async () => {
    const ctx = createMockCtx();
    registerMiningQueueHandlers(ctx as never);
    addQueueItemMock.mockRejectedValue(new Error('idb down'));

    const res = await ctx.handlers.get(MESSAGE_TYPES.QUEUE_ADD)!({
      payload: { tabId: -1, item: INPUT },
    });
    expect(res).toEqual({ success: false, error: 'idb down' });
    await flush();
    expect(ctx.broadcast).not.toHaveBeenCalled();
  });

  it('QUEUE_LIST returns lean rows', async () => {
    const ctx = createMockCtx();
    registerMiningQueueHandlers(ctx as never);
    const rows: MiningQueueRow[] = [
      { id: 'q2', kind: 'sentence', sentence: 'a', createdAt: 2 },
    ];
    listQueueRowsMock.mockResolvedValue(rows);

    const res = await ctx.handlers.get(MESSAGE_TYPES.QUEUE_LIST)!({ payload: { tabId: -1 } });
    expect(res).toEqual({ success: true, data: { rows } });
  });

  it('QUEUE_GET returns the full item', async () => {
    const ctx = createMockCtx();
    registerMiningQueueHandlers(ctx as never);
    const item = { id: 'q1', dedupeKey: 'k', createdAt: 1, ...INPUT } as MiningQueueItem;
    getQueueItemMock.mockResolvedValue(item);

    const res = await ctx.handlers.get(MESSAGE_TYPES.QUEUE_GET)!({
      payload: { tabId: -1, id: 'q1' },
    });
    expect(res).toEqual({ success: true, data: { item } });
  });

  it('QUEUE_REMOVE broadcasts only when a row was actually deleted', async () => {
    const ctx = createMockCtx();
    registerMiningQueueHandlers(ctx as never);

    removeQueueItemMock.mockResolvedValue(false);
    await ctx.handlers.get(MESSAGE_TYPES.QUEUE_REMOVE)!({ payload: { tabId: -1, id: 'nope' } });
    await flush();
    expect(ctx.broadcast).not.toHaveBeenCalled();

    removeQueueItemMock.mockResolvedValue(true);
    const res = await ctx.handlers.get(MESSAGE_TYPES.QUEUE_REMOVE)!({
      payload: { tabId: -1, id: 'q1' },
    });
    expect(res).toEqual({ success: true, data: { removed: true } });
    await flush();
    expect(ctx.broadcast).toHaveBeenCalled();
  });
});
