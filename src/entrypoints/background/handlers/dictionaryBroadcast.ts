// dictionaryBroadcast — fan out DICTIONARY_CHANGED to every context.
// runtime.sendMessage (messageBus.broadcast) reaches extension pages only;
// content scripts need chrome.tabs.sendMessage fan-out per tab/frame — same
// split as broadcastToOtherTabs in the word-status handler. Best-effort: a
// missing chrome.tabs or messageBus (tests, restricted envs) must never fail
// the mutation that triggered the broadcast.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import { queryTabs, sendMessageToAllFramesInTab } from '@/shared/lib/chrome-apis/tabs';

export function broadcastDictionaryChanged(
  ctx: BackgroundContext,
  langCode: string,
  reason: string,
): void {
  const payload = { reason, langCode };
  const message = { type: MESSAGE_TYPES.DICTIONARY_CHANGED, payload };
  try {
    ctx.messageBus.broadcast(message);
  } catch {
    // Minimal contexts without a messageBus (unit tests) — skip silently.
  }
  try {
    void queryTabs({})
      .then((tabs) =>
        Promise.allSettled(
          tabs
            .filter((tab) => tab.id !== undefined)
            .map((tab) => sendMessageToAllFramesInTab(tab.id!, message)),
        ),
      )
      .catch(() => {});
  } catch {
    // chrome.tabs unavailable (unit tests) — skip tab fan-out.
  }
}
