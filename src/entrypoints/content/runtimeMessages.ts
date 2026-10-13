import { waitForCachedSubtitleBody } from '@/features/subtitle/logic/subtitleResponseCache';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { messagePayload } from '@/entities/message/payload';
import { isTihokaDebug } from './debugLog';
import { getLastRelayedVideoId } from './subtitleBridges';
import {
  isCondensedAudioSessionActive,
  notifyCondensedAudioRecordStatus,
  startCondensedAudioSession,
  stopCondensedAudioSession,
} from '@/features/condensedAudio/condensedAudioRecorder';
import type {
  CondenseAudioEventPayload,
  CondenseAudioSessionStartPayload,
  CondenseAudioSessionStopPayload,
} from '@/entities/message';

export function installRuntimeMessageListener(): void {
  // Debug: respond to PING from SW/DevTools so we can verify injection.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'PING') {
      const win = window as unknown as Record<string, unknown>;
      sendResponse({
        ok: true,
        csInjected: true,
        readyState: document.readyState,
        url: location.href,
        ...(isTihokaDebug()
          ? {
              hasYtDebug: typeof win.__YT_DEBUG !== 'undefined',
              csInjectTime: win.__YT_CS_INJECT_TIME,
              msgListenerRegistered: true,
              lastRelayedVideoId: getLastRelayedVideoId(),
              scanInfo: win.__Tihoka_SCAN_INFO,
            }
          : {}),
      });
      return false;
    }

    // Generic page-context subtitle fetch.
    //
    // Some subtitle endpoints require the page's authenticated session cookies or
    // are blocked when fetched from the service worker / offscreen document
    // (cross-origin, no cookie jar). The background asks the content script,
    // which runs in the page origin, to fetch the raw subtitle text. Any site
    // with a same-origin subtitle URL can use this path.
    //
    // Ephemeral token endpoints (e.g. onzload) cannot be re-fetched once the
    // player consumes the token, so the response is cached at interception time.
    // Wait briefly for the cache before trying a replay.
    if (msg?.type === MESSAGE_TYPES.FETCH_SUBTITLE_PAGE_CONTEXT) {
      const payload = messagePayload<{ url: string }>(msg, MESSAGE_TYPES.FETCH_SUBTITLE_PAGE_CONTEXT);
      const url = payload?.url;
      if (!url) {
        sendResponse({ success: false, error: 'missing url' });
        return false;
      }
      void (async () => {
        try {
          const cached = await waitForCachedSubtitleBody(url, 5000);
          if (cached) {
            sendResponse({ success: true, content: cached });
            return;
          }
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15_000);
          const response = await fetch(url, {
            credentials: 'same-origin',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            sendResponse({ success: false, error: `HTTP ${response.status}` });
            return;
          }
          const content = await response.text();
          sendResponse({ success: true, content });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          sendResponse({ success: false, error: message });
        }
      })();
      return true;
    }

    if (msg?.type === MESSAGE_TYPES.CONDENSE_AUDIO_SESSION_START) {
      if (window.top !== window) return false;
      const payload = messagePayload<CondenseAudioSessionStartPayload>(
        msg,
        MESSAGE_TYPES.CONDENSE_AUDIO_SESSION_START,
      );
      if (!payload?.recordId || !payload.ranges?.length) {
        sendResponse({ success: false, error: 'invalid payload' });
        return false;
      }
      void startCondensedAudioSession(payload.recordId, payload.ranges, payload.padMs ?? 0, {
        onOpenLibrary: () => void import('./featureInit').then((m) => m.ensureUniversalPanelMount().open('playlist')),
      }).then(
        (result) => {
          sendResponse(result.ok ? { success: true } : { success: false, error: result.error });
        },
      );
      return true;
    }

    if (msg?.type === MESSAGE_TYPES.CONDENSE_AUDIO_SESSION_STOP) {
      const payload = messagePayload<CondenseAudioSessionStopPayload>(
        msg,
        MESSAGE_TYPES.CONDENSE_AUDIO_SESSION_STOP,
      );
      if (payload?.recordId) stopCondensedAudioSession(payload.recordId);
      sendResponse({ success: true });
      return false;
    }

    if (msg?.type === MESSAGE_TYPES.CONDENSE_AUDIO_EVENT) {
      const payload = messagePayload<CondenseAudioEventPayload>(
        msg,
        MESSAGE_TYPES.CONDENSE_AUDIO_EVENT,
      );
      const removedId = payload?.removedId;
      if (removedId && isCondensedAudioSessionActive(removedId)) {
        stopCondensedAudioSession(removedId);
      } else if (removedId) {
        notifyCondensedAudioRecordStatus(removedId, 'removed');
      }
      const record = payload?.record;
      if (record) notifyCondensedAudioRecordStatus(record.id, record.status);
      if (
        record &&
        isCondensedAudioSessionActive(record.id) &&
        (record.status === 'failed' || record.status === 'ready' || record.status === 'missing')
      ) {
        stopCondensedAudioSession(record.id);
      }
      return false;
    }

    return false;
  });
}
