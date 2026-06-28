import { useEffect, useState } from 'react';
import { useSidePanelStore } from './store/sidePanelStore';
import { CueList } from './components/CueList';
import { getActiveContentTabId } from '@/popup/utils/getActiveContentTab';
import { handleShortcutKey } from '@/content/subtitleShortcuts';
import { DEFAULT_KEYBOARD_SHORTCUTS } from '@/constants/config';
import type { BilingualCue, KeyboardShortcut } from '@/types/media';

export function App() {
  const cues = useSidePanelStore((s) => s.cues);
  const currentTimeMs = useSidePanelStore((s) => s.currentTimeMs);
  const isPlaying = useSidePanelStore((s) => s.isPlaying);
  const [shortcuts] = useState<KeyboardShortcut[]>(() => {
    // Load shortcuts from storage async; start with defaults so hotkeys
    // work immediately on panel open. Updated below via effect.
    return DEFAULT_KEYBOARD_SHORTCUTS;
  });

  useEffect(() => {
    // Listen for messages from background (relayed from content script)
    const listener = (msg: { type: string; payload?: unknown }) => {
      if (!msg?.type) return;
      switch (msg.type) {
        case 'SUBTITLE_CUES_LOADED': {
          const payload = msg.payload as { cues: BilingualCue[] } | undefined;
          if (payload?.cues) {
            useSidePanelStore.getState().setCues(payload.cues);
          }
          break;
        }
        case 'VIDEO_TIME_UPDATE': {
          const payload = msg.payload as { currentTimeMs: number; durationMs: number } | undefined;
          if (payload) {
            useSidePanelStore.getState().setCurrentTime(payload.currentTimeMs, payload.durationMs);
          }
          break;
        }
        case 'VIDEO_PLAY_STATE': {
          const payload = msg.payload as { isPlaying: boolean } | undefined;
          if (payload) {
            useSidePanelStore.getState().setPlaying(payload.isPlaying);
          }
          break;
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Request cached cues on mount — handles the race where the panel opens
  // AFTER the content-script already sent SUBTITLE_CUES_LOADED (which was
  // dropped because no listener was registered yet). Background caches the
  // last cues per tab and re-sends them here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tabId = await getActiveContentTabId();
      if (cancelled || tabId === undefined) return;
      try {
        const res = await chrome.runtime.sendMessage({
          type: 'REQUEST_SUBTITLE_CUES',
          payload: { tabId },
        });
        if (cancelled) return;
        const cuesFromCache = (res as { success?: boolean; data?: { cues?: BilingualCue[] } })?.data?.cues;
        if (cuesFromCache && cuesFromCache.length > 0) {
          // Only set if store is still empty (don't overwrite cues that
          // arrived via the live SUBTITLE_CUES_LOADED listener in the meantime)
          if (useSidePanelStore.getState().cues.length === 0) {
            useSidePanelStore.getState().setCues(cuesFromCache);
          }
        }
      } catch {
        // Background may be asleep — silently ignore; live listener will
        // catch the next SUBTITLE_CUES_LOADED.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSeek = (timeMs: number) => {
    chrome.runtime.sendMessage({ type: 'SEEK_TO', payload: { timeMs } });
  };

  // Spacebar → toggle play/pause (only when focus is not in an input/textarea)
  // Also wire user-configured keyboard shortcuts (prev-cue / next-cue /
  // replay-cue / toggle-overlay / toggle-panel) so the side panel can
  // control the video using the same hotkeys as the in-page overlay.
  useEffect(() => {
    // Load user-configured shortcuts from storage (overrides defaults)
    let currentShortcuts = shortcuts;
    chrome.storage.local.get('settings').then((result) => {
      const stored = (result.settings as { keyboardShortcuts?: KeyboardShortcut[] } | undefined)?.keyboardShortcuts;
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
        chrome.runtime.sendMessage({ type: 'TOGGLE_PLAY' });
        return;
      }

      // User-configured shortcuts → cue navigation / overlay / panel
      const action = handleShortcutKey(e.key.toLowerCase(), currentShortcuts, e.target);
      if (!action) return;
      e.preventDefault();
      switch (action) {
        case 'prev-cue':
        case 'next-cue':
        case 'replay-cue':
          chrome.runtime.sendMessage({ type: 'SHORTCUT_ACTION', payload: { action } });
          break;
        case 'toggle-overlay':
          // Overlay lives in the content page — relay via background
          chrome.runtime.sendMessage({ type: 'SHORTCUT_ACTION', payload: { action: 'toggle-overlay' } });
          break;
        case 'toggle-panel':
          // Already in the panel — no-op (or could focus the panel)
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts]);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#141414', color: '#fff' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>Subtitles</span>
        {cues.length > 0 && (
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            {cues.length} cues {isPlaying ? '▶' : '⏸'}
          </span>
        )}
      </div>
      {cues.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
          No subtitles loaded
        </div>
      ) : (
        <CueList cues={cues} currentTimeMs={currentTimeMs} onSeek={handleSeek} />
      )}
    </div>
  );
}
