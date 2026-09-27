import { ProviderError } from '../ports/storageProvider';
import type { StorageProvider } from '../ports/storageProvider';
import { getStorageProvider, registeredProviders, REGISTERED_PROVIDERS } from './providerRegistry';
import { createGoogleDriveStorageProvider } from '../adapters/google-drive/googleDriveDefaults';

jest.mock('../adapters/google-drive/googleDriveDefaults', () => ({
  createGoogleDriveStorageProvider: jest.fn(
    () => ({ providerId: 'google-drive', displayName: 'Google Drive' }) as unknown as StorageProvider,
  ),
}));

describe('providerRegistry', () => {
  it('exposes only google-drive', () => {
    expect(registeredProviders()).toEqual([
      { providerId: 'google-drive', displayName: 'Google Drive' },
    ]);
    expect(REGISTERED_PROVIDERS).toHaveLength(1);
  });

  it('returns the google-drive adapter for its id', () => {
    const provider = getStorageProvider('google-drive');
    expect(provider.providerId).toBe('google-drive');
    expect(createGoogleDriveStorageProvider).toHaveBeenCalledWith({});
  });

  it('rejects unregistered provider ids', () => {
    expect(() => getStorageProvider('onedrive')).toThrow(ProviderError);
    expect(() => getStorageProvider('dropbox')).toThrow(/no storage provider registered/);
  });
});
