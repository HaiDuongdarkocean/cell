import { sendAction, invokeAnkiConnect } from '@/features/cardCreator';
import { DEFAULT_CARD_CREATOR_SETTINGS } from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import type { AnkiConnectInvoker } from '../adapters/connectAdapter';

/** Saved AnkiConnect URL from Card Creator settings (falls back to localhost default). */
export async function getStoredAnkiConnectUrl(): Promise<string> {
  try {
    const settings = await loadSettings();
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

/** Direct AnkiConnect fetch — safe inside the service worker itself, where
 *  chrome.runtime.sendMessage would not reach the CARD_CREATOR_REQUEST
 *  handler (messages never loop back to their sender context). */
export function createDirectInvoker(url: string): AnkiConnectInvoker {
  return (action, params) =>
    invokeAnkiConnect(globalThis.fetch.bind(globalThis), url, action, params);
}
