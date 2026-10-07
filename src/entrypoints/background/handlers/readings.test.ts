import { registerReadingsHandlers } from './readings';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import * as resourceRepository from '@/features/dictionary/repositories/resourceRepository';
import * as resourceEntryRepository from '@/features/dictionary/repositories/resourceEntryRepository';
import type { DictionaryEntry, ResourceInfo } from '@/entities/dictionary';

jest.mock('@/features/dictionary/repositories/resourceRepository', () => ({
  getAllResources: jest.fn(),
}));

jest.mock('@/features/dictionary/repositories/resourceEntryRepository', () => ({
  findDictionaryByTerms: jest.fn(),
}));

const getAllResourcesMock = resourceRepository.getAllResources as jest.MockedFunction<
  typeof resourceRepository.getAllResources
>;
const findDictionaryByTermsMock = resourceEntryRepository.findDictionaryByTerms as jest.MockedFunction<
  typeof resourceEntryRepository.findDictionaryByTerms
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
    langCode: 'zh',
    type: 'DICTIONARY',
    format: 'json-entries',
    signature: `sig-${id}`,
    wordCount: 10,
    installationFinished: true,
    importedAt: 1,
    ...overrides,
  };
}

function makeEntry(term: string, resourceId: number, overrides: Partial<DictionaryEntry> = {}): DictionaryEntry {
  return {
    resourceId,
    term,
    reading: '',
    altterm: '',
    pronunciation: '',
    definition: '',
    pos: '',
    examples: '',
    audio: '',
    ...overrides,
  };
}

async function call(payload: unknown): Promise<{ success: boolean; data?: { readings: Record<string, string> }; error?: string }> {
  const ctx = createMockCtx();
  registerReadingsHandlers(ctx as unknown as Parameters<typeof registerReadingsHandlers>[0]);
  const handler = ctx.handlers.get(MESSAGE_TYPES.READINGS_GET);
  return handler?.({ payload }) as Promise<{ success: boolean; data?: { readings: Record<string, string> }; error?: string }>;
}

describe('READINGS_GET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an invalid payload', async () => {
    const res = await call({ langCode: 'zh', terms: 'not-an-array' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid READINGS_GET payload');
  });

  it('returns an empty map when no dictionary-capable resource is eligible', async () => {
    getAllResourcesMock.mockResolvedValue([
      makeResource(1, { enabled: false }),
      makeResource(2, { installationFinished: false }),
      makeResource(3, { components: ['frequency'] }),
    ]);

    const res = await call({ tabId: -1, langCode: 'zh', terms: ['你好'] });

    expect(res).toEqual({ success: true, data: { readings: {} } });
    expect(findDictionaryByTermsMock).not.toHaveBeenCalled();
  });

  it('prefers pronunciation and higher-priority resources', async () => {
    getAllResourcesMock.mockResolvedValue([
      makeResource(1, { priority: 5 }),
      makeResource(2, { priority: 1 }),
    ]);
    findDictionaryByTermsMock.mockResolvedValue(
      new Map([
        ['你好', [
          makeEntry('你好', 1, { pronunciation: 'nǐ hǎo-wrong' }),
          makeEntry('你好', 2, { pronunciation: 'nǐ hǎo' }),
        ]],
      ]),
    );

    const res = await call({ tabId: -1, langCode: 'zh', terms: ['你好'] });

    expect(res.success).toBe(true);
    expect(res.data?.readings['你好']).toBe('nǐ hǎo');
    const allowed = findDictionaryByTermsMock.mock.calls[0]?.[2];
    expect(allowed).toEqual(new Set([1, 2]));
  });

  it('skips reading === term so a lower-priority real reading wins', async () => {
    getAllResourcesMock.mockResolvedValue([
      makeResource(1, { priority: 1 }),
      makeResource(2, { priority: 5 }),
    ]);
    findDictionaryByTermsMock.mockResolvedValue(
      new Map([
        ['walk', [
          makeEntry('walk', 1, { reading: 'walk' }),
          makeEntry('walk', 2, { reading: 'wɔːk' }),
        ]],
      ]),
    );

    const res = await call({ tabId: -1, langCode: 'zh', terms: ['walk'] });

    expect(res.data?.readings['walk']).toBe('wɔːk');
  });

  it('honors disabledComponents on the pronunciation component', async () => {
    getAllResourcesMock.mockResolvedValue([
      makeResource(1, { priority: 1, disabledComponents: ['pronunciation'] }),
      makeResource(2, { priority: 5 }),
    ]);
    findDictionaryByTermsMock.mockResolvedValue(
      new Map([
        ['你好', [
          makeEntry('你好', 1, { pronunciation: 'nǐ hǎo' }),
          makeEntry('你好', 2, { reading: 'néih hóu' }),
        ]],
      ]),
    );

    const res = await call({ tabId: -1, langCode: 'zh', terms: ['你好'] });

    expect(res.data?.readings['你好']).toBe('néih hóu');
  });

  it('omits terms whose only reading equals the term', async () => {
    getAllResourcesMock.mockResolvedValue([makeResource(1)]);
    findDictionaryByTermsMock.mockResolvedValue(
      new Map([
        ['walk', [makeEntry('walk', 1, { reading: 'walk' })]],
        ['gone', []],
      ]),
    );

    const res = await call({ tabId: -1, langCode: 'zh', terms: ['walk', 'gone'] });

    expect(res).toEqual({ success: true, data: { readings: {} } });
  });
});
