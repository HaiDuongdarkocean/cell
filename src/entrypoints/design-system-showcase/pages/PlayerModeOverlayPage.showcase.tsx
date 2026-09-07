import { useEffect, useState, type ReactElement } from 'react';
import { PlayerModeOverlay } from '@/features/subtitle/ui/PlayerModeOverlay';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE, DEFAULT_SUBTITLE_BLOCK_SETTINGS, DEFAULT_NAV_CLUSTER_SETTINGS } from '@/shared/config/config';
import { getMockCues, getMockBilingualCues, getMockCueActiveIndex } from '../mockCues';
import { useCuesStore } from '@/stores/cuesStore';
import styles from './PlayerModeOverlayPage.module.css';

const MOCK_CUES = getMockBilingualCues();

export function Showcase(): ReactElement {
  const [isPlaying, setIsPlaying] = useState(true);
  const [repeatActive, setRepeatActive] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [cueListOpen, setCueListOpen] = useState(true);
  const [currentTimeMs, setCurrentTimeMs] = useState(4500);

  useEffect(() => {
    const { targetCues, nativeCues } = getMockCues();
    const activeIndex = getMockCueActiveIndex();
    const store = useCuesStore.getState();
    store.setCues(targetCues, nativeCues);
    store.setActiveIndex(activeIndex, activeIndex);
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.frame}>
        {/* PlayerModeOverlay renders fixed full-viewport — contain it in a scaled frame */}
        <div className={styles.overlayMount}>
          <PlayerModeOverlay
            targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
            nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
            isPlaying={isPlaying}
            repeatActive={repeatActive}
            clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
            blockSettings={DEFAULT_SUBTITLE_BLOCK_SETTINGS}
            videoAspectRatio={16 / 9}
            toolsExpanded={toolsExpanded}
            onToggleTools={() => setToolsExpanded((v) => !v)}
            onPrev={() => {}}
            onNext={() => {}}
            onRepeat={() => setRepeatActive((v) => !v)}
            onRewind={() => {}}
            onForward={() => {}}
            onPlayPause={() => setIsPlaying((v) => !v)}
            onToggleCollapsed={() => {}}
            onExit={() => {}}
            onQuickAdd={() => {}}
            onEditCard={() => {}}
            onToggleOcr={() => {}}
            onGenerateNative={() => {}}
            onToggleSidePanel={() => setCueListOpen((v) => !v)}
            onToggleManager={() => {}}
            generateNativeEnabled
            cues={cueListOpen ? MOCK_CUES : undefined}
            currentTimeMs={currentTimeMs}
            onSeek={(ms) => setCurrentTimeMs(ms)}
          />
        </div>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Player Mode Overlay Page',
  description: 'Full-viewport Player Mode: split layout (video stage + cue list sidebar, resizable drag handle), bottom action dock (NavCluster + SubtitleBlock + tools). Esc exits, T toggles cue list. Responsive: >480px row split, <480px column stack.',
  level: 'pages' as const,
  category: 'Overlay',
  order: 15,
};
