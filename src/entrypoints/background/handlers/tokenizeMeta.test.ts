import { registerTokenizeMetaHandlers } from './tokenizeMeta';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import * as resourceRepository from '@/features/dictionary/repositories/resourceRepository';
import * as resourceEntryRepository from '@/features/dictionary/repositories/resourceEntryRepository';
import * as wordStatusStore from '@/features/dictionary/services/wordStatusStore';
import type { FrequencyEntry, ResourceInfo, WordStatus } from '@/entities/dictionary';

jest.mock('@/features/dictionary/repositories/resourceRepository', () => ({
  getAllResources: jest.fn(),
}));

jest.mock('@/features/dictionary/repositories/resourceEntryRepository', () => ({
  findFrequencyByTerms: jest.fn(),
}));

jest.mock('@/features/dictionary/services/wordStatusStore', () => ({
  getWordStatuses: jest.fn(),
}));

const getAllResourcesMock = resourceRepository.getAllResources as jest.MockedFunction<
  typeof resourceRepository.getAllResources
>;
const findFrequencyByTermsMock = resourceEntryRepository.findFrequencyByTerms as jest.MockedFunction<
  typeof resourceEntryRepository.findFrequencyByTerms
>;
const getWordStatusesMock = wordStatusStore.getWordStatuses as jest.MockedFunction<
  typeof wordStatusStore.getWordStatuses
>;

function createMockCtx(): {
  handlers: Map<string, (request: { payload: unknown }) => Promise<unknown>>;
  on: (type: string, handler: (request: { payload: unknown }) => Promise<unknown>) => void;
  messageBus: { broadcast: jest.Mock };
} {
  const handlers = new Map<string, (request: { payload: unknown }) => Promise<unknown>>();
  return {
    handlers,
    on: (type, handler) => {
      handlers.set(type, handler);
    },
    messageBus: { broadcast: jest.fn() },
  };
}

function makeResource(id: number, overrides: Partial<ResourceInfo> = {}): ResourceInfo {
  return {
    id,
    name: `res-${id}`,
    langCode: 'en',
    type: 'FREQUENCY',
    format: 'json-entries',
    signature: `sig-${id}`,
    wordCount: 10,
    installationFinished: true,
    components: ['frequency'],
    ...overrides,
    importedAt: overrides.importedAt ?? 1,
  };
}

interface MetaData {
  statuses: Record<string, WordStatus>;
  frequencyEntries: Record<string, FrequencyEntry[]>;
}

async function callMeta(payload: unknown): Promise<{ success: boolean; data?: MetaData; error?: string }> {
  const ctx = createMockCtx();
  registerTokenizeMetaHandlers(ctx as unknown as Parameters<typeof registerTokenizeMetaHandlers>[0]);
  const handler = ctx.handlers.get(MESSAGE_TYPES.TOKENIZE_META_GET);
  return handler?.({ payload }) as Promise<{ success: boolean; data?: MetaData; error?: string }>;
}

async function callPing(payload: unknown): Promise<{ success: boolean; error?: string }> {
  const ctx = createMockCtx();
  registerTokenizeMetaHandlers(ctx as unknown as Parameters<typeof registerTokenizeMetaHandlers>[0]);
  const handler = ctx.handlers.get(MESSAGE_TYPES.TOKENIZE_PING);
  return handler?.({ payload }) as Promise<{ success: boolean; error?: string }>;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TOKENIZE_META_GET', () => {
  beforeEach(() => {
    getAllResourcesMock.mockResolvedValue([makeResource(1)]);
  });

  it('rejects an invalid payload', async () => {
    const res = await callMeta({ langCode: 'en', terms: 'nope' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid TOKENIZE_META_GET payload');
  });

  it('returns statuses and frequency entries in one response', async () => {
    getWordStatusesMock.mockResolvedValue(new Map([['hello', 'known']]));
    findFrequencyByTermsMock.mockResolvedValue(
      new Map([['hello', [{ resourceId: 1, term: 'hello', reading: '', frequency: 42 }]]]),
    );

    const res = await callMeta({ tabId: -1, langCode: 'en', terms: ['hello'] });

    expect(res).toEqual({
      success: true,
      data: {
        statuses: { hello: 'known' },
        frequencyEntries: { hello: [{ resourceId: 1, term: 'hello', reading: '', frequency: 42 }] },
      },
    });
    expect(getWordStatusesMock).toHaveBeenCalledWith('en', ['hello']);
    expect(findFrequencyByTermsMock).toHaveBeenCalledWith('en', ['hello'], new Set([1]));
  });

  it('keeps statuses when the frequency leg fails', async () => {
    getWordStatusesMock.mockResolvedValue(new Map([['hello', 'known']]));
    findFrequencyByTermsMock.mockRejectedValue(new Error('freq store down'));

    const res = await callMeta({ tabId: -1, langCode: 'en', terms: ['hello'] });

    expect(res.success).toBe(true);
    expect(res.data?.statuses).toEqual({ hello: 'known' });
    expect(res.data?.frequencyEntries).toEqual({});
  });

  it('keeps frequency entries when the status leg fails', async () => {
    getWordStatusesMock.mockRejectedValue(new Error('status store down'));
    findFrequencyByTermsMock.mockResolvedValue(
      new Map([['hello', [{ resourceId: 1, term: 'hello', reading: '', frequency: 7 }]]]),
    );

    const res = await callMeta({ tabId: -1, langCode: 'en', terms: ['hello'] });

    expect(res.success).toBe(true);
    expect(res.data?.statuses).toEqual({});
    expect(res.data?.frequencyEntries.hello?.[0]?.frequency).toBe(7);
  });

  it('skips the frequency lookup when no enabled resource offers it', async () => {
    getAllResourcesMock.mockResolvedValue([
      makeResource(1, { enabled: false }),
      makeResource(2, { installationFinished: false }),
      makeResource(3, { components: ['definitions'] }),
    ]);
    getWordStatusesMock.mockResolvedValue(new Map([['hello', 'unknown']]));

    const res = await callMeta({ tabId: -1, langCode: 'en', terms: ['hello'] });

    expect(res.success).toBe(true);
    expect(res.data).toEqual({ statuses: { hello: 'unknown' }, frequencyEntries: {} });
    expect(findFrequencyByTermsMock).not.toHaveBeenCalled();
  });
});

describe('TOKENIZE_PING', () => {
  it('resolves without touching stores', async () => {
    const res = await callPing({ tabId: -1 });
    expect(res).toEqual({ success: true });
    expect(getWordStatusesMock).not.toHaveBeenCalled();
    expect(getAllResourcesMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed payload', async () => {
    const res = await callPing({});
    expect(res.success).toBe(false);
  });
});
