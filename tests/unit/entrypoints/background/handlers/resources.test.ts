import { registerResourceHandlers } from '@/entrypoints/background/handlers/resources';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { clearDictionaryProbeCache } from '@/features/dictionaryPopup/logic/lookupOrchestrator';
import type { BackgroundContext } from '@/entrypoints/background/context';
import type { MessageRequest, MessageResponse } from '@/entities/message';

jest.mock('@/features/dictionaryPopup/logic/lookupOrchestrator', () => ({
  clearDictionaryProbeCache: jest.fn(),
}));

jest.mock('@/features/dictionary/repositories/resourceRepository', () => ({
  getAllResources: jest.fn(async () => []),
  getResource: jest.fn(),
  reorderResources: jest.fn(),
  setResourceEnabled: jest.fn(),
  setResourceName: jest.fn(),
  setResourceProfiles: jest.fn(),
  setResourceDisabledComponents: jest.fn(),
  setResourceComponents: jest.fn(),
}));

jest.mock('@/features/dictionary/repositories/dictionaryRepository', () => ({
  sampleDictionaryEntries: jest.fn(async () => []),
  findDictionaryEntry: jest.fn(),
  findDictionaryByResource: jest.fn(async () => []),
}));

jest.mock('@/features/dictionary/repositories/frequencyRepository', () => ({
  sampleFrequencyEntries: jest.fn(async () => []),
  findFrequencyEntry: jest.fn(),
}));

jest.mock('@/features/dictionary/logic/dictionaryComponents', () => ({
  collectEntryComponents: jest.fn(() => new Set()),
  sortedComponents: jest.fn(() => []),
}));

jest.mock('@/features/dictionary/logic/importOrchestrator', () => ({
  importFile: jest.fn(),
  deleteResourceCascade: jest.fn(),
  rollbackImport: jest.fn(),
}));

jest.mock('@/entrypoints/background/handlers/jobs', () => ({
  getJobRegistry: jest.fn(() => ({ registerExecutor: jest.fn() })),
  whenJobsReady: jest.fn(async () => undefined),
}));

jest.mock('@/shared/i18n', () => ({ t: (key: string) => key }));

type Handler = (request: MessageRequest) => Promise<MessageResponse<unknown>>;

function makeContext() {
  const handlers = new Map<string, Handler>();
  const ctx = {
    on: jest.fn((type: string, fn: Handler) => {
      handlers.set(type, fn);
    }),
  } as unknown as BackgroundContext;
  registerResourceHandlers(ctx);
  return handlers;
}

const mockedClear = clearDictionaryProbeCache as jest.MockedFunction<typeof clearDictionaryProbeCache>;

describe('resource handlers — lookup context invalidation', () => {
  beforeEach(() => {
    mockedClear.mockClear();
  });

  it('RESOURCE_RENAME clears the lookup cache', async () => {
    const handlers = makeContext();
    const res = await handlers.get(MESSAGE_TYPES.RESOURCE_RENAME)!({
      type: MESSAGE_TYPES.RESOURCE_RENAME,
      payload: { langCode: 'en', resourceId: 1, name: 'new-name' },
    } as MessageRequest);
    expect(res).toMatchObject({ success: true });
    expect(mockedClear).toHaveBeenCalledTimes(1);
  });

  it('RESOURCE_SET_COMPONENTS clears the lookup cache', async () => {
    const handlers = makeContext();
    const res = await handlers.get(MESSAGE_TYPES.RESOURCE_SET_COMPONENTS)!({
      type: MESSAGE_TYPES.RESOURCE_SET_COMPONENTS,
      payload: { langCode: 'en', resourceId: 1, disabledComponents: ['examples'] },
    } as MessageRequest);
    expect(res).toMatchObject({ success: true });
    expect(mockedClear).toHaveBeenCalledTimes(1);
  });
});
