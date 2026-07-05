import { useEffect, useRef, useState } from 'react';
import { useSidePanelStore } from './store/sidePanelStore';
import { CueList } from './components/CueList';
import { getActiveContentTabId } from '@/entrypoints/popup/utils/getActiveContentTab';
import { handleShortcutKey } from '@/features/subtitle';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/shared/config/config';
import { sendMessage, onMessage, removeOnMessageListener, addOnTabActivatedListener, addOnTabUpdatedListener } from '@/shared/lib/chrome-apis';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import type { BilingualCue, KeyboardShortcut } from '@/entities/media';
import styles from './App.module.css';

export function App() {
  const cues = useSidePanelStore((s) => s.cues);
  const currentTimeMs = useSidePanelStore((s) => s.currentTimeMs);
  const offsetMs = useSidePanelStore((s) => s.offsetMs);
  const isPlaying = useSidePanelStore((s) => s.isPlaying);
  const [shortcuts] = useState<KeyboardShortcut[]>(() => {
    // Load shortcuts from storage async; start with defaults so hotkeys
    // work immediately on panel open. Updated below via effect.
    return DEFAULT_KEYBOARD_SHORTCUTS;
  });

  // Active content tab id — kept in a ref so the broadcast listener (created
  // once) always reads the latest value without re-subscribing. Mirrors the
  // pattern in popup's useDetectedMedia (ADR-011: side panel per-tab state).
  const activeTabIdRef = useRef<number | undefined>(undefined);

  // Reset store + re-fetch cached cues for a tab. Called on mount and on
  // chrome.tabs.onActivated (user switches tab). Reset is required so a tab
  // with no cached cues shows "No subtitles loaded" instead of the previous
  // tab's stale cues.
  const syncActiveTab = async (tabId: number | undefined): Promise<void> => {
    activeTabIdRef.current = tabId;
    const store = useSidePanelStore.getState();
    store.setCues([]);
    store.setCurrentTime(0, 0);
    store.setPlaying(false);
    if (tabId === undefined) return;
    try {
      const res = await sendMessage({
        type: 'REQUEST_SUBTITLE_CUES',
        payload: { tabId },
      });
      const cuesFromCache = (res as { success?: boolean; data?: { cues?: BilingualCue[] } })?.data?.cues;
      if (cuesFromCache && cuesFromCache.length > 0 && activeTabIdRef.current === tabId) {
        useSidePanelStore.getState().setCues(cuesFromCache);
      }
    } catch {
      // Background may be asleep — silently ignore; live listener will
      // catch the next SUBTITLE_CUES_LOADED for this tab.
    }
  };

  useEffect(() => {
    let cancelled = false;

    // Listen for messages from background (relayed from content script).
    // TWO-LAYER filter (ADR-011 v3):
    //   1. Drop messages with tabId === undefined — these are raw broadcasts
    //      from content-script (chrome.runtime.sendMessage fans out to ALL
    //      extension listeners including this panel). Only accept messages
    //      that passed through background (which injects sender.tab.id).
    //   2. Drop messages whose tabId !== activeTabIdRef — background already
    //      filters at the relay point (only active tab relayed), but this is
    //      a defense-in-depth guard in case background's activeTabIdForPanel
    //      is stale (SW restart, race).
    const listener = (msg: { type: string; payload?: unknown }) => {
      if (!msg?.type) return;
      const payload = msg.payload as { tabId?: number } | undefined;
      // Layer 1: drop raw content-script broadcasts (tabId undefined).
      // These bypass background's filter entirely.
      if (payload?.tabId === undefined) return;
      // Layer 2: defense-in-depth — only accept the active tab.
      if (payload.tabId !== activeTabIdRef.current) return;
      switch (msg.type) {
        case 'SUBTITLE_CUES_LOADED': {
          const cuesPayload = payload as { cues: BilingualCue[] } | undefined;
          if (cuesPayload?.cues) {
            useSidePanelStore.getState().setCues(cuesPayload.cues);
          }
          break;
        }
        case 'VIDEO_TIME_UPDATE': {
          const timePayload = payload as { currentTimeMs: number; durationMs: number; offsetMs?: number } | undefined;
          if (timePayload) {
            useSidePanelStore.getState().setCurrentTime(
              timePayload.currentTimeMs,
              timePayload.durationMs,
              timePayload.offsetMs,
            );
          }
          break;
        }
        case 'VIDEO_PLAY_STATE': {
          const playPayload = payload as { isPlaying: boolean } | undefined;
          if (playPayload) {
            useSidePanelStore.getState().setPlaying(playPayload.isPlaying);
          }
          break;
        }
      }
    };
    onMessage(listener as unknown as Parameters<typeof onMessage>[0]);

    // Tab activation → re-fetch cues for the newly-active tab.
    // ponytail: only onActivated is tracked. A background tab navigating
    // (onUpdated loading) while not active won't clear the panel — but the
    // panel isn't showing that tab anyway, so no bug. Ceiling: track all
    // tab lifecycles if panel ever shows non-active tabs.
    const onActivated = (activeInfo: chrome.tabs.OnActivatedInfo): void => {
      if (cancelled) return;
      void syncActiveTab(activeInfo.tabId);
    };
    const unsubTabActivated = addOnTabActivatedListener(onActivated);

    // Same-tab navigation on the active tab → background deletes
    // lastCuesByTab[tabId] (onTabUpdated loading, index.ts:534). Mirror that
    // here so the panel doesn't show stale cues from the previous URL while
    // the new URL's subtitles autoload.
    const onUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
    ): void => {
      if (cancelled) return;
      if (tabId !== activeTabIdRef.current) return;
      if (changeInfo.status === 'loading') {
        // Same-tab navigation: background deletes lastCuesByTab[tabId]
        // (index.ts:534). Mirror that here so the panel doesn't show stale
        // cues from the previous URL while the new URL's subtitles autoload.
        const store = useSidePanelStore.getState();
        store.setCues([]);
        store.setCurrentTime(0, 0);
        store.setPlaying(false);
      } else if (changeInfo.status === 'complete') {
        // Defense-in-depth: if a live SUBTITLE_CUES_LOADED was dropped (e.g.
        // background activeTabIdForPanel race during tab switch), re-fetch the
        // cached cues for the now-loaded page. This is idempotent: if the live
        // message already arrived, the cached cues are the same data.
        void syncActiveTab(tabId);
      }
    };
    const unsubTabUpdated = addOnTabUpdatedListener(onUpdated);

    // Initial sync: resolve active content tab + fetch its cached cues.
    (async () => {
      const tabId = await getActiveContentTabId();
      if (cancelled) return;
      void syncActiveTab(tabId);
    })();

    return () => {
      cancelled = true;
      removeOnMessageListener(listener as unknown as Parameters<typeof removeOnMessageListener>[0]);
      unsubTabActivated();
      unsubTabUpdated();
    };
  }, []);

  const handleSeek = (timeMs: number) => {
    void sendMessage({ type: 'SEEK_TO', payload: { timeMs } });
  };

  // Spacebar → toggle play/pause (only when focus is not in an input/textarea)
  // Also wire user-configured keyboard shortcuts (prev-cue / next-cue /
  // replay-cue / toggle-overlay / toggle-panel) so the side panel can
  // control the video using the same hotkeys as the in-page overlay.
  useEffect(() => {
    // Load user-configured shortcuts from storage (overrides defaults)
    let currentShortcuts = shortcuts;
    loadSettings().then((settings) => {
      const stored = settings.keyboardShortcuts;
      if (stored && stored.length > 0) currentShortcuts = stored;
    }).catch(() => { /* fallback to defaults */ });

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return; // let the field handle the key
      }

      // Spacebar → toggle play/pause (not remappable, always Space)
      if (e.code === 'Space') {
        e.preventDefault(); // prevent page scroll
        void sendMessage({ type: 'TOGGLE_PLAY' });
        return;
      }

      // User-configured shortcuts → cue navigation / overlay / panel
      const action = handleShortcutKey(e.key.toLowerCase(), currentShortcuts, e.target);
      if (!action) return;
      e.preventDefault();
      switch (action) {
        case 'prev-cue':
        case 'next-cue':
        case 'replay-cue': {
          // ADR-021 D8: calculate seek target locally from sidepanel's currentTimeMs
          // (close to keypress time) instead of letting content script calculate from
          // video.currentTime at message arrival (~300ms later, video has advanced).
          // This prevents highlight from jumping forward before seek arrives.
          const store = useSidePanelStore.getState();
          const cues = store.cues;
          const effectiveMs = store.currentTimeMs + (store.offsetMs ?? 0);
          let targetCue: BilingualCue | undefined;
          if (action === 'prev-cue') {
            targetCue = [...cues].reverse().find((c) => c.end < effectiveMs);
          } else if (action === 'next-cue') {
            targetCue = cues.find((c) => c.start > effectiveMs + 100);
          } else {
            // replay-cue: half-open [start, end), fallback to last cue before effective
            targetCue = cues.find((c) => c.start <= effectiveMs && c.end > effectiveMs)
              ?? [...cues].reverse().find((c) => c.start < effectiveMs);
          }
          if (targetCue) {
            void sendMessage({ type: 'SHORTCUT_ACTION', payload: { action, seekTime: targetCue.start } });
          }
          break;
        }
        case 'toggle-overlay':
          // Overlay lives in the content page — relay via background
          void sendMessage({ type: 'SHORTCUT_ACTION', payload: { action: 'toggle-overlay' } });
          break;
        case 'toggle-panel':
          // Already in the panel — no-op (or could focus the panel)
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts]);

  // ADR-022: theme áp dụng qua ThemeProvider (wraps sidepanel in main.tsx).
  // Removed duplicate theme effect — ThemeProvider handles :root CSS vars +
  // data-theme attr + storage.onChanged sync (themeMode + themeConfig keys).

  return (
    <div className={styles.app}>
      <div className={styles.header}>
        <span className={styles.title}>Subtitles</span>
        {cues.length > 0 && (
          <span className={styles.meta}>
            {cues.length} cues {isPlaying ? '▶' : '⏸'}
          </span>
        )}
      </div>
      {cues.length === 0 ? (
        <div className={styles.empty}>
          No subtitles loaded
        </div>
      ) : (
        <CueList cues={cues} currentTimeMs={currentTimeMs} offsetMs={offsetMs} onSeek={handleSeek} />
      )}
    </div>
  );
}
