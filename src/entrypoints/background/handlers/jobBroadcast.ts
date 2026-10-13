// jobBroadcast — fan out JOB_EVENT to every context.
// runtime.sendMessage (messageBus.broadcast) reaches extension pages only;
// content scripts (universal panel job rows, resource delete progress) need
// chrome.tabs.sendMessage fan-out per tab/frame — same split as
// dictionaryBroadcast. Best-effort: a missing chrome.tabs or messageBus
// (tests, restricted envs) must never fail the job mutation itself.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { Job } from '@/entities/job/types';
import type { BackgroundContext } from '../context';
import { queryTabs, sendMessageToAllFramesInTab } from '@/shared/lib/chrome-apis/tabs';

export function broadcastJobEvent(
  ctx: BackgroundContext,
  payload: { job?: Job; removedId?: string },
): void {
  const message = { type: MESSAGE_TYPES.JOB_EVENT, payload };
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
