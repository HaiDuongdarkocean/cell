import type { ProviderId } from '../domain/types';
import { ProviderError } from '../ports/storageProvider';
import type { StorageProvider } from '../ports/storageProvider';
import { createGoogleDriveStorageProvider } from '../adapters/google-drive/googleDriveDefaults';
import type { GoogleDriveStorageProviderDeps } from '../adapters/google-drive/googleDriveStorageProvider';

export interface RegisteredProvider {
  providerId: ProviderId;
  displayName: string;
}

export const REGISTERED_PROVIDERS: readonly RegisteredProvider[] = [
  { providerId: 'google-drive', displayName: 'Google Drive' },
];

export function registeredProviders(): readonly RegisteredProvider[] {
  return REGISTERED_PROVIDERS;
}

export function getStorageProvider(
  providerId: ProviderId,
  deps: Partial<GoogleDriveStorageProviderDeps> = {},
): StorageProvider {
  if (providerId === 'google-drive') {
    return createGoogleDriveStorageProvider(deps);
  }
  throw new ProviderError('unknown', `no storage provider registered for: ${providerId}`);
}
