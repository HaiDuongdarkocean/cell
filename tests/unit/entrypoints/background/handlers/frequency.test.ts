import { registerFrequencyHandlers } from '@/entrypoints/background/handlers/frequency';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { getAllResources } from '@/features/dictionary/repositories/resourceRepository';
import { findFrequencyByTerms } from '@/features/dictionary/repositories/resourceEntryRepository';
import type { BackgroundContext } from '@/entrypoints/background/context';
import type { MessageRequest, MessageResponse } from '@/entities/message';
import type { ResourceInfo } from '@/entities/dictionary';

jest.mock('@/features/dictionary/repositories/resourceRepository', () => ({
  getAllResources: jest.fn(async () => []),
}));

jest.mock('@/features/dictionary/repositories/resourceEntryRepository', () => ({
  findFrequencyByTerms: jest.fn(async () => new Map()),
}));

const mockedResources = getAllResources as jest.MockedFunction<typeof getAllResources>;
const mockedFind = findFrequencyByTerms as jest.MockedFunction<typeof findFrequencyByTerms>;

type Handler = (request: MessageRequest) => Promise<MessageResponse<{ entries: Record<string, unknown[]> }>>;

function makeContext() {
  const handlers = new Map<string, Handler>();
  const ctx = {
    on: jest.fn((type: string, fn: Handler) => {
      handlers.set(type, fn);
    }),
  } as unknown as BackgroundContext;
  registerFrequencyHandlers(ctx);
  return handlers;
}

function resource(overrides: Partial<ResourceInfo>): ResourceInfo {
  return {
    id: 1,
    name: 'freq',
    langCode: 'en',
    type: 'FREQUENCY',
    format: 'txt',
    signature: 'sig',
    wordCount: 10,
    installationFinished: true,
    importedAt: 0,
    enabled: true,
    components: ['frequency'],
    ...overrides,
  };
}

const request = {
  type: MESSAGE_TYPES.FREQUENCY_GET,
  payload: { tabId: -1, langCode: 'en', terms: ['hello'] },
} as MessageRequest;

describe('frequency handler — FREQUENCY_GET gating', () => {
  beforeEach(() => {
    mockedResources.mockReset();
    mockedFind.mockReset();
    mockedFind.mockResolvedValue(new Map());
  });

  it('queries only enabled, finished, frequency-offering resources', async () => {
    mockedResources.mockResolvedValue([
      resource({ id: 1 }),
      resource({ id: 2, enabled: false }),
      resource({ id: 3, disabledComponents: ['frequency'] }),
      resource({ id: 4, installationFinished: false }),
      resource({ id: 5, components: ['definitions'], type: 'DICTIONARY' }),
    ]);
    const res = await makeContext().get(MESSAGE_TYPES.FREQUENCY_GET)!(request);
    expect(res.success).toBe(true);
    const allowed = mockedFind.mock.calls[0]?.[2] as Set<number>;
    expect([...allowed].sort()).toEqual([1]);
  });

  it('honours the legacy FREQUENCY type fallback for rows without components', async () => {
    mockedResources.mockResolvedValue([
      resource({ id: 1, components: undefined }),
    ]);
    await makeContext().get(MESSAGE_TYPES.FREQUENCY_GET)!(request);
    const allowed = mockedFind.mock.calls[0]?.[2] as Set<number>;
    expect([...allowed]).toEqual([1]);
  });

  it('skips the repository query entirely when no resource is eligible', async () => {
    mockedResources.mockResolvedValue([
      resource({ id: 2, enabled: false }),
      resource({ id: 3, disabledComponents: ['frequency'] }),
    ]);
    const res = await makeContext().get(MESSAGE_TYPES.FREQUENCY_GET)!(request);
    expect(res.success).toBe(true);
    expect(mockedFind).not.toHaveBeenCalled();
  });
});
