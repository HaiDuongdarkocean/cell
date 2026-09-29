import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { registerLookupHandlers } from './lookup';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { lookupOrchestratorMulti } from '@/features/dictionaryPopup/logic/lookupOrchestrator';
import { requestRemoteCheck } from '../syncTriggers';

jest.mock('@/features/dictionaryPopup/logic/lookupOrchestrator', () => ({
  lookupOrchestratorMulti: jest.fn(),
}));

jest.mock('../syncTriggers', () => ({
  requestRemoteCheck: jest.fn(),
  isFirstStatusesGetForTab: jest.fn(() => true),
}));

const mockedLookup = lookupOrchestratorMulti as jest.MockedFunction<
  typeof lookupOrchestratorMulti
>;
const mockedCheck = requestRemoteCheck as jest.MockedFunction<typeof requestRemoteCheck>;

function createMockCtx() {
  const handlers = new Map<string, (request: { payload: unknown }) => Promise<unknown>>();
  return {
    handlers,
    on: (type: string, handler: (request: { payload: unknown }) => Promise<unknown>) => {
      handlers.set(type, handler);
    },
  };
}

const payload = {
  requestId: 'req-1',
  request: { term: 'call', langCode: 'en', contextSentence: 'a call', cursorOffset: 0 },
};

describe('LOOKUP_REQUEST remote check trigger (SC-12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fires requestRemoteCheck after a successful lookup', async () => {
    mockedLookup.mockResolvedValue([]);
    const ctx = createMockCtx();
    registerLookupHandlers(ctx as never);
    const res = await ctx.handlers.get(MESSAGE_TYPES.LOOKUP_REQUEST)!({ payload });
    expect(res).toEqual({ success: true, data: [] });
    expect(mockedCheck).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the lookup fails', async () => {
    mockedLookup.mockRejectedValue(new Error('nope'));
    const ctx = createMockCtx();
    registerLookupHandlers(ctx as never);
    const res = await ctx.handlers.get(MESSAGE_TYPES.LOOKUP_REQUEST)!({ payload });
    expect(res).toEqual({ success: false, error: 'nope' });
    expect(mockedCheck).not.toHaveBeenCalled();
  });
});
