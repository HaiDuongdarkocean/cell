import {
  getSessionStorage,
  getStorage,
  removeSessionStorage,
  removeStorage,
  setSessionStorage,
  setStorage,
} from '@/shared/lib/chrome-apis/storage';
import type { KvArea, KeyValueStore } from '../../ports/keyValueStore';
import { GoogleDriveStorageProvider } from './googleDriveStorageProvider';
import type { GoogleDriveStorageProviderDeps, WebAuthFlowRequest } from './googleDriveStorageProvider';

export function googleOAuthClientId(): string {
  const value = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined;
  return value ?? '';
}

export function chromeIdentityLaunchFlow(
  request: WebAuthFlowRequest,
): Promise<string | undefined> {
  return chrome.identity.launchWebAuthFlow({
    url: request.url,
    interactive: request.interactive,
    abortOnLoadForNonInteractive: request.abortOnLoadForNonInteractive,
    timeoutMsForNonInteractive: request.timeoutMsForNonInteractive,
  });
}

export function chromeIdentityRedirectUrl(): string {
  return chrome.identity.getRedirectURL();
}

export class ChromeStorageKeyValueStore implements KeyValueStore {
  async get<T>(area: KvArea, key: string): Promise<T | undefined> {
    const items =
      area === 'session'
        ? await getSessionStorage<Record<string, unknown>>(key)
        : await getStorage<Record<string, unknown>>(key);
    return items[key] as T | undefined;
  }

  async set(area: KvArea, key: string, value: unknown): Promise<void> {
    if (area === 'session') {
      await setSessionStorage({ [key]: value });
    } else {
      await setStorage({ [key]: value });
    }
  }

  async del(area: KvArea, key: string): Promise<void> {
    if (area === 'session') {
      await removeSessionStorage(key);
    } else {
      await removeStorage(key);
    }
  }

  async list(area: KvArea, prefix: string): Promise<string[]> {
    const items =
      area === 'session'
        ? await getSessionStorage<Record<string, unknown>>(null)
        : await getStorage<Record<string, unknown>>(null);
    return Object.keys(items)
      .filter((key) => key.startsWith(prefix))
      .sort();
  }
}

export function createGoogleDriveStorageProvider(
  deps: Partial<GoogleDriveStorageProviderDeps> = {},
): GoogleDriveStorageProvider {
  return new GoogleDriveStorageProvider({
    kv: deps.kv ?? new ChromeStorageKeyValueStore(),
    clientId: deps.clientId ?? googleOAuthClientId(),
    launchWebAuthFlow: deps.launchWebAuthFlow ?? chromeIdentityLaunchFlow,
    getRedirectUrl: deps.getRedirectUrl ?? chromeIdentityRedirectUrl,
    fetchFn: deps.fetchFn,
    clock: deps.clock,
    sleep: deps.sleep,
    retryAttempts: deps.retryAttempts,
    resumableThresholdBytes: deps.resumableThresholdBytes,
    silentFlowTimeoutMs: deps.silentFlowTimeoutMs,
  });
}
