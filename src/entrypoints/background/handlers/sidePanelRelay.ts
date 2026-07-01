/**
 * Side panel relay message handlers — OPEN_SIDE_PANEL, VIDEO_TIME_UPDATE,
 * VIDEO_PLAY_STATE, SEEK_TO, TOGGLE_PLAY, SHORTCUT_ACTION, VIDEO_EPISODE_CHANGED.
 *
 * ADR-008 D4: background relays messages between content-script and side panel.
 * ADR-011 v3: relay only for the active content tab (no flicker from background tabs).
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  openSidePanel,
  sendMessage,
  queryTabs,
  sendTabMessage,
} from '@/shared/lib/chrome-apis';
import type { BackgroundContext } from '../context';
import {
  updateBadgeForTab,
  clearSessionMedia,
} from '../helpers';
import type {
  MessageResponse,
  OpenSidePanelPayload,
  VideoTimeUpdatePayload,
  VideoPlayStatePayload,
  SeekToPayload,
  ShortcutActionPayload,
  VideoEpisodeChangedPayload,
} from '@/types/message';

/** Register side panel relay message handlers. */
export function registerSidePanelRelayHandlers(ctx: BackgroundContext): void {
  // OPEN_SIDE_PANEL: content-script asks background to open the side panel.
  ctx.on(MESSAGE_TYPES.OPEN_SIDE_PANEL, async (request): Promise<MessageResponse> => {
    const payload = request.payload as OpenSidePanelPayload;
    const tabId = payload?.tabId;
    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in OPEN_SIDE_PANEL' };
    }
    try {
      await openSidePanel({ tabId });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`OPEN_SIDE_PANEL failed for tab ${tabId}: ${msg}`);
      return { success: false, error: msg };
    }
  });

  // VIDEO_TIME_UPDATE: relay current playback time to side panel (active tab only).
  ctx.on(MESSAGE_TYPES.VIDEO_TIME_UPDATE, async (request): Promise<MessageResponse> => {
    const payload = request.payload as VideoTimeUpdatePayload;
    if (payload?.currentTimeMs === undefined) {
      return { success: false, error: 'Missing currentTimeMs' };
    }
    if (payload.tabId !== undefined && payload.tabId !== ctx.activeTabIdForPanel) {
      return { success: true };
    }
    try {
      await sendMessage({
        type: MESSAGE_TYPES.VIDEO_TIME_UPDATE,
        payload: {
          tabId: payload.tabId,
          currentTimeMs: payload.currentTimeMs,
          durationMs: payload.durationMs,
        },
      });
    } catch {
      // Side panel may not be open — silently ignore
    }
    return { success: true };
  });

  // VIDEO_PLAY_STATE: relay play/pause state to side panel (active tab only).
  ctx.on(MESSAGE_TYPES.VIDEO_PLAY_STATE, async (request): Promise<MessageResponse> => {
    const payload = request.payload as VideoPlayStatePayload;
    if (payload?.isPlaying === undefined) {
      return { success: false, error: 'Missing isPlaying' };
    }
    if (payload.tabId !== undefined && payload.tabId !== ctx.activeTabIdForPanel) {
      return { success: true };
    }
    try {
      await sendMessage({
        type: MESSAGE_TYPES.VIDEO_PLAY_STATE,
        payload: { tabId: payload.tabId, isPlaying: payload.isPlaying },
      });
    } catch {
      // Side panel may not be open — silently ignore
    }
    return { success: true };
  });

  // SEEK_TO: side panel asks background to seek the video in the content script.
  ctx.on(MESSAGE_TYPES.SEEK_TO, async (request): Promise<MessageResponse> => {
    const payload = request.payload as SeekToPayload;
    let tabId = payload?.tabId;
    const timeMs = payload?.timeMs;
    if (timeMs === undefined) {
      return { success: false, error: 'Missing timeMs in SEEK_TO' };
    }
    if (tabId === undefined) {
      try {
        const [activeTab] = await queryTabs({ active: true, currentWindow: true });
        if (!activeTab?.id) {
          return { success: false, error: 'No active tab found for SEEK_TO' };
        }
        tabId = activeTab.id;
      } catch {
        return { success: false, error: 'Failed to query active tab for SEEK_TO' };
      }
    }
    try {
      await sendTabMessage(tabId, {
        type: MESSAGE_TYPES.SEEK_TO,
        payload: { timeMs },
      });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`SEEK_TO relay failed for tab ${tabId}: ${msg}`);
      return { success: false, error: msg };
    }
  });

  // TOGGLE_PLAY: side panel asks background to toggle play/pause.
  ctx.on(MESSAGE_TYPES.TOGGLE_PLAY, async (request): Promise<MessageResponse> => {
    let tabId = (request.payload as { tabId?: number })?.tabId;
    if (tabId === undefined) {
      try {
        const [activeTab] = await queryTabs({ active: true, currentWindow: true });
        if (!activeTab?.id) {
          return { success: false, error: 'No active tab found for TOGGLE_PLAY' };
        }
        tabId = activeTab.id;
      } catch {
        return { success: false, error: 'Failed to query active tab for TOGGLE_PLAY' };
      }
    }
    try {
      await sendTabMessage(tabId, {
        type: MESSAGE_TYPES.TOGGLE_PLAY,
      });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`TOGGLE_PLAY relay failed for tab ${tabId}: ${msg}`);
      return { success: false, error: msg };
    }
  });

  // SHORTCUT_ACTION: side panel asks background to trigger a cue navigation shortcut.
  ctx.on(MESSAGE_TYPES.SHORTCUT_ACTION, async (request): Promise<MessageResponse> => {
    const payload = request.payload as ShortcutActionPayload;
    const action = payload?.action;
    if (!action || !['prev-cue', 'next-cue', 'replay-cue', 'toggle-overlay'].includes(action)) {
      return { success: false, error: `Invalid shortcut action: ${action}` };
    }
    let tabId = payload?.tabId;
    if (tabId === undefined) {
      try {
        const [activeTab] = await queryTabs({ active: true, currentWindow: true });
        if (!activeTab?.id) {
          return { success: false, error: 'No active tab found for SHORTCUT_ACTION' };
        }
        tabId = activeTab.id;
      } catch {
        return { success: false, error: 'Failed to query active tab for SHORTCUT_ACTION' };
      }
    }
    try {
      await sendTabMessage(tabId, {
        type: MESSAGE_TYPES.SHORTCUT_ACTION,
        payload: { action },
      });
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`SHORTCUT_ACTION relay failed for tab ${tabId}: ${msg}`);
      return { success: false, error: msg };
    }
  });

  // VIDEO_EPISODE_CHANGED: content-script detected an in-page episode switch.
  ctx.on(MESSAGE_TYPES.VIDEO_EPISODE_CHANGED, async (request): Promise<MessageResponse> => {
    const payload = request.payload as VideoEpisodeChangedPayload;
    const tabId = payload?.tabId;
    if (tabId === undefined) {
      return { success: false, error: 'Missing tabId in VIDEO_EPISODE_CHANGED payload' };
    }
    ctx.networkInterceptor.clearTab(tabId);
    clearSessionMedia(ctx, tabId);
    ctx.lastCuesByTab.delete(tabId);
    ctx.autoDownloadedTabs.delete(tabId);
    updateBadgeForTab(ctx, tabId);
    console.log('[bg VIDEO_EPISODE_CHANGED] cleared media for tab', tabId);
    return { success: true };
  });
}
