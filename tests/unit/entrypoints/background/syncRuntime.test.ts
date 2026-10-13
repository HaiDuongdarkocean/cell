import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  broadcastApplied,
  createSyncRuntime,
  providerFor,
} from '@/entrypoints/background/syncRuntime';
import { createGoogleDriveStorageProvider } from '@/features/sync/adapters/google-drive/googleDriveDefaults';
import { clearDictionaryProbeCache } from '@/features/dictionaryPopup/logic/lookupOrchestrator';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { SyncAppliedPayload } from '@/features/sync/app/SyncEngine';

jest.mock('@/features/sync/adapters/google-drive/googleDriveDefaults', () => ({
  createGoogleDriveStorageProvider: jest.fn(() => ({ providerId: 'google-drive' })),
}));

jest.mock('@/shared/lib/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/features/dictionaryPopup/logic/lookupOrchestrator', () => ({
  clearDictionaryProbeCache: jest.fn(),
}));

const mockedCreateProvider = createGoogleDriveStorageProvider as jest.MockedFunction<
  typeof createGoogleDriveStorageProvider
>;

const payload: SyncAppliedPayload = {
  scopes: ['global'],
  dataClasses: ['wordStatus'],
};

let query: jest.Mock;
let sendMessage: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  query = jest.fn(async () => [{ id: 1 }, { id: 2 }]);
  sendMessage = jest.fn(() => Promise.resolve(undefined));
  (globalThis as { chrome?: unknown }).chrome = {
    tabs: { query, sendMessage },
  };
});

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('providerFor memoization (SC-1b)', () => {
  it('returns the same provider instance for repeated calls', () => {
    const first = providerFor('google-drive');
    const second = providerFor('google-drive');
    expect(second).toBe(first);
    expect(mockedCreateProvider).toHaveBeenCalledTimes(1);
  });
});

describe('broadcastApplied tab fan-out (SC-13)', () => {
  it('broadcasts to the runtime and sends one message per tab', async () => {
    const broadcast = jest.fn();
    createSyncRuntime({ broadcast });
    await broadcastApplied(payload);
    expect(broadcast).toHaveBeenCalledWith('SYNC_DATA_APPLIED', payload);
    expect(query).toHaveBeenCalledWith({});
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenCalledWith(
      2,
      { type: MESSAGE_TYPES.SYNC_DATA_APPLIED, payload },
    );
  });

  it('swallows per-tab send failures', async () => {
    sendMessage.mockImplementation(() => Promise.reject(new Error('closed')));
    const broadcast = jest.fn();
    createSyncRuntime({ broadcast });
    await expect(broadcastApplied(payload)).resolves.toBeUndefined();
    expect(broadcast).toHaveBeenCalledWith('SYNC_DATA_APPLIED', payload);
  });

  it('clears dictionary lookup caches when dictResource was applied', async () => {
    createSyncRuntime({ broadcast: jest.fn() });
    await broadcastApplied({ scopes: ['global'], dataClasses: ['dictResource'] });
    expect(clearDictionaryProbeCache).toHaveBeenCalledTimes(1);
  });

  it('keeps dictionary lookup caches for other data classes', async () => {
    createSyncRuntime({ broadcast: jest.fn() });
    await broadcastApplied(payload);
    expect(clearDictionaryProbeCache).not.toHaveBeenCalled();
  });

  it('swallows a query failure', async () => {
    query.mockImplementation(() => Promise.reject(new Error('no tabs api')));
    const broadcast = jest.fn();
    createSyncRuntime({ broadcast });
    await expect(broadcastApplied(payload)).resolves.toBeUndefined();
    expect(broadcast).toHaveBeenCalledWith('SYNC_DATA_APPLIED', payload);
  });
});
