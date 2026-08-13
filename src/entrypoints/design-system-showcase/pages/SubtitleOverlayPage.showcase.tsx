import { useEffect, useState, type ReactElement } from 'react';
import { SubtitlePanels } from '@/features/subtitle/ui/SubtitlePanels';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/shared/config/config';
import type { SubtitlePanelItem } from '@/features/subtitle/ui/subtitlePanelModel';
import { mockTargetCues, mockNativeCues } from '../mockCues';
import { useCuesStore } from '@/stores/cuesStore';
import styles from './SubtitleOverlayPage.module.css';

const TARGET_ITEMS: SubtitlePanelItem[] = [
  { id: 't1', name: 'English #1', format: 'srt', size: 24576, source: 'auto', role: 'target', index: 0 },
];
const NATIVE_ITEMS: SubtitlePanelItem[] = [
  { id: 'n1', name: 'Vietnamese (translated)', format: 'srt', size: 18432, source: 'translated', role: 'native', index: 0 },
];

export function Showcase(): ReactElement {
  const [isPlaying, setIsPlaying] = useState(true);
  const [repeatActive, setRepeatActive] = useState(false);

  // Seed the cues store so SubtitleBlock renders mock cues
  useEffect(() => {
    const store = useCuesStore.getState();
    store.setCues(mockTargetCues, mockNativeCues);
    store.setActiveIndex(1, 1);
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.videoFrame}>
        <div className={styles.videoPlaceholder}>
          <span className={styles.videoLabel}>Video Player Area</span>
        </div>
        <div className={styles.overlayLayer}>
          <SubtitlePanels
            targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
            nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
            collapsed={false}
            isPlaying={isPlaying}
            repeatActive={repeatActive}
            yOffsetPercent={75}
            onPrev={() => {}}
            onNext={() => {}}
            onRepeat={() => setRepeatActive((v) => !v)}
            onRewind={() => {}}
            onForward={() => {}}
            onPlayPause={() => setIsPlaying((v) => !v)}
            onToggleCollapsed={() => {}}
            onQuickAdd={() => {}}
            onEditCard={() => {}}
            onUpdateCurrentCard={() => {}}
            onGenerateNative={() => {}}
            onToggleSidePanel={() => {}}
            onToggleManager={() => {}}
            manager={{
              targetItems: TARGET_ITEMS,
              nativeItems: NATIVE_ITEMS,
              targetActiveIndex: 0,
              nativeActiveIndex: 0,
              onSelect: () => {},
              onImport: () => {},
              onGenerateNative: () => {},
              onOffsetChange: () => {},
              hasSearchKeys: false,
              onOpenSettings: () => {},
              onSearchResultSelect: () => {},
            }}
            offset={{
              targetMs: 0,
              nativeMs: 0,
              onTargetChange: () => {},
              onNativeChange: () => {},
            }}
            generateNativeEnabled
          />
        </div>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Subtitle Overlay Page',
  description: 'In-page subtitle overlay with NavCluster (prev/next/repeat/rewind/forward/play-pause), SubtitleBlock (target + native layered), manager panel, offset panel, toasts, and drag-drop hint. Mounted via Shadow DOM on video pages.',
  level: 'pages' as const,
  category: 'Overlay',
  order: 10,
};
