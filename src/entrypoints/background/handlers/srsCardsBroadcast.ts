// srsCardsBroadcast — fan out SRS_CARDS_CHANGED to every context (same
// split as broadcastQueueChanged: tabs fan-out reaches content scripts,
// runtime broadcast reaches extension pages). Best-effort so a missing
// chrome.tabs or messageBus never fails the mutation that triggered it.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import { queryTabs, sendMessageToAllFramesInTab } from '@/shared/lib/chrome-apis/tabs';

export async function broadcastSrsCardsChanged(
  ctx: BackgroundContext,
  langCode: string,
): Promise<void> {
  const message = { type: MESSAGE_TYPES.SRS_CARDS_CHANGED, payload: { langCode } };
  try {
    ctx.messageBus.broadcast(message);
  } catch {
    // Minimal contexts without a messageBus (unit tests) — skip silently.
  }
  try {
    const tabs = await queryTabs({});
    await Promise.allSettled(
      tabs
        .filter((tab) => tab.id !== undefined)
        .map((tab) => sendMessageToAllFramesInTab(tab.id!, message)),
    );
  } catch {
    // chrome.tabs unavailable (unit tests) — skip tab fan-out.
  }
}
