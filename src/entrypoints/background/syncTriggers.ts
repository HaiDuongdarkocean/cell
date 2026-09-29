import { getSessionStorage, setSessionStorage } from '@/shared/lib/chrome-apis/storage';
import {
  addOnTabRemovedListener,
  addOnTabUpdatedListener,
} from '@/shared/lib/chrome-apis/tabs';
import { logger } from '@/shared/lib/logger';

export const REMOTE_CHECK_WINDOW_MS = 3_000;
export const REMOTE_CHECK_LAST_KEY = 'syncLastCheckAt';

export interface SyncTriggersDeps {
  readonly hasConnections: () => Promise<boolean>;
  readonly checkRemote: () => Promise<unknown>;
  readonly now?: () => number;
  readonly sessionGet?: (key: string) => Promise<unknown>;
  readonly sessionSet?: (key: string, value: unknown) => Promise<void>;
}

let deps: SyncTriggersDeps | undefined;
let lastCheckAt: number | undefined;
let seedPromise: Promise<void> | undefined;
const navigationSeen = new Set<number>();

const now = (): number => deps?.now?.() ?? Date.now();

const sessionGet = async (key: string): Promise<unknown> => {
  if (deps?.sessionGet !== undefined) return deps.sessionGet(key);
  const data = await getSessionStorage<Record<string, unknown>>([key]);
  return data[key];
};

const sessionSet = async (key: string, value: unknown): Promise<void> => {
  if (deps?.sessionSet !== undefined) return deps.sessionSet(key, value);
  await setSessionStorage({ [key]: value });
};

export function configureSyncTriggers(next: SyncTriggersDeps): Array<() => void> {
  deps = next;
  const unsubs: Array<() => void> = [];
  if (typeof chrome !== 'undefined' && chrome.tabs !== undefined) {
    unsubs.push(
      addOnTabUpdatedListener((tabId, changeInfo) => {
        if (changeInfo.url !== undefined || changeInfo.status === 'loading') {
          navigationSeen.delete(tabId);
        }
      }),
      addOnTabRemovedListener((tabId) => {
        navigationSeen.delete(tabId);
      }),
    );
  }
  return unsubs;
}

export function resetSyncTriggersForTests(): void {
  deps = undefined;
  lastCheckAt = undefined;
  seedPromise = undefined;
  navigationSeen.clear();
}

export function isFirstStatusesGetForTab(tabId: number): boolean {
  if (tabId <= 0 || navigationSeen.has(tabId)) return false;
  navigationSeen.add(tabId);
  return true;
}

export function requestRemoteCheck(): void {
  const current = deps;
  if (current === undefined) return;
  void (async () => {
    if (lastCheckAt === undefined) {
      seedPromise ??= (async () => {
        try {
          const stored = await sessionGet(REMOTE_CHECK_LAST_KEY);
          lastCheckAt = typeof stored === 'number' ? stored : 0;
        } catch {
          lastCheckAt = 0;
        }
      })();
      await seedPromise;
    }
    if (lastCheckAt !== undefined && now() - lastCheckAt < REMOTE_CHECK_WINDOW_MS) return;
    if (!(await current.hasConnections().catch(() => false))) return;
    if (lastCheckAt !== undefined && now() - lastCheckAt < REMOTE_CHECK_WINDOW_MS) return;
    lastCheckAt = now();
    void sessionSet(REMOTE_CHECK_LAST_KEY, lastCheckAt).catch(() => undefined);
    await current.checkRemote().catch((error) =>
      logger.warn('sync: remote check failed', {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  })();
}
