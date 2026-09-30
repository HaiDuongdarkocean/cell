import { sendAction } from '@/features/cardCreator/service/cardCreatorService';
import { STORAGE_KEYS } from '@/shared/config/config';
import { DEFAULT_CARD_CREATOR_SETTINGS } from '@/shared/config/config';
import type { Settings } from '@/entities/settings';
import type { AnkiConnectInvoker } from '../adapters/connectAdapter';

/** Saved AnkiConnect URL from Card Creator settings (falls back to localhost default). */
export async function getStoredAnkiConnectUrl(): Promise<string> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    const settings = data?.[STORAGE_KEYS.SETTINGS] as Settings | undefined;
    return settings?.cardCreator?.ankiConnectUrl || DEFAULT_CARD_CREATOR_SETTINGS.ankiConnectUrl;
  } catch {
    return DEFAULT_CARD_CREATOR_SETTINGS.ankiConnectUrl;
  }
}

/** Wrap the existing Card Creator background bridge into a throwing invoker. */
export function createBackgroundInvoker(url: string): AnkiConnectInvoker {
  return async (action, params) => {
    const result = await sendAction(url, action, params);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
}
