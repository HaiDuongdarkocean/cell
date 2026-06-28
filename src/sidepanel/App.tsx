import { useEffect } from 'react';
import { useSidePanelStore } from './store/sidePanelStore';
import { CueList } from './components/CueList';

export function App() {
  const cues = useSidePanelStore((s) => s.cues);
  const currentTimeMs = useSidePanelStore((s) => s.currentTimeMs);
  const isPlaying = useSidePanelStore((s) => s.isPlaying);

  useEffect(() => {
    // Listen for messages from background (relayed from content script)
    const listener = (msg: { type: string; payload?: unknown }) => {
      if (!msg?.type) return;
      switch (msg.type) {
        case 'SUBTITLE_CUES_LOADED': {
          const payload = msg.payload as { cues: import('@/types/media').BilingualCue[] } | undefined;
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

  const handleSeek = (timeMs: number) => {
    chrome.runtime.sendMessage({ type: 'SEEK_TO', payload: { timeMs } });
  };

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
