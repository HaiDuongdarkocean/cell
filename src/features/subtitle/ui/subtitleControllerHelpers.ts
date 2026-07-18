import { sendMessage } from '@/shared/lib/chrome-apis';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { showToast } from './subtitleUI';
import type { TranslateResult } from '@/entities/message';
import type { BilingualCue } from '@/entities/media';
import type { Settings } from '@/entities/settings';

/**
 * Create the `translate` callback for `BackgroundPrefillController`.
 *
 * Sends a TRANSLATE message to the background script and unwraps the response.
 * Extracted from 4 identical inline closures in `contentScriptController.ts`.
 *
 * Pure — only uses `sl`, `tl` params + `sendMessage` import.
 */
export function createTranslateFunction(
  sl: string,
  tl: string,
): (text: string) => Promise<string[]> {
  return async (text: string): Promise<string[]> => {
    const res = await sendMessage<{ success?: boolean; data?: TranslateResult; error?: string }>({
      type: MESSAGE_TYPES.TRANSLATE,
      payload: { text, sl, tl },
    });
    if (!res?.success || !res.data?.translated) {
      throw new Error(res?.error ?? 'translate failed');
    }
    return res.data.translated;
  };
}

/**
 * Broadcast bilingual cues to the Side Panel via `SUBTITLE_CUES_LOADED`.
 *
 * Extracted from 6+ identical `sendMessage` calls in `contentScriptController.ts`.
 *
 * Pure — only uses `cues` param + `sendMessage` import.
 */
export function broadcastCues(cues: BilingualCue[]): void {
  void sendMessage({
    type: MESSAGE_TYPES.SUBTITLE_CUES_LOADED,
    payload: { tabId: undefined, cues },
  });
}

/**
 * Load settings with error toast fallback.
 *
 * Returns `undefined` if storage is unavailable (toast shown to user).
 * Extracted from 3 identical try/catch blocks in `contentScriptController.ts`.
 *
 * Pure — only uses `container` param + `loadSettings`/`showToast` imports.
 */
export async function loadSettingsOrToast(
  container: HTMLElement,
): Promise<Settings | undefined> {
  try {
    return await loadSettings();
  } catch {
    showToast('Cannot load settings — storage unavailable.', container, { variant: 'error' });
    return undefined;
  }
}
