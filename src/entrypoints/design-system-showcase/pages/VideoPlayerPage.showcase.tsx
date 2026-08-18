import { useEffect, useRef, useState, useCallback, type ReactElement } from 'react';
import { SubtitlePanels } from '@/features/subtitle/ui/SubtitlePanels';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE, DEFAULT_SUBTITLE_BLOCK_SETTINGS, DEFAULT_NAV_CLUSTER_SETTINGS } from '@/shared/config/config';
import { parseSrt } from '@/shared/lib/parsers/srtParser';
import { useCuesStore } from '@/stores/cuesStore';
import type { SrtCue } from '@/entities/media';
import type { SubtitlePanelItem } from '@/features/subtitle/ui/subtitlePanelModel';
import helloSrt from '../assets/hello.srt?raw';
import helloMp4 from '../assets/hello.mp4?url';
import styles from './VideoPlayerPage.module.css';

// Parse SRT → SrtCue[] once at module load (pure function, no side effects)
const TARGET_CUES: SrtCue[] = parseSrt(helloSrt).cues;
// Native cues = same timing, empty text (no translation for this demo)
const NATIVE_CUES: SrtCue[] = TARGET_CUES.map((c) => ({ ...c, text: '' }));

const TARGET_ITEMS: SubtitlePanelItem[] = [
  { id: 't1', name: 'English (Hello — Adele)', format: 'srt', size: 5269, source: 'auto', role: 'target', index: 0 },
];
const NATIVE_ITEMS: SubtitlePanelItem[] = [
  { id: 'n1', name: 'Vietnamese (auto-translate)', format: 'srt', size: 0, source: 'translated', role: 'native', index: 0 },
];

/** Find active cue index by binary search on time. O(log n). */
function findActiveIndex(cues: readonly SrtCue[], timeMs: number): number {
  let lo = 0, hi = cues.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= timeMs) {
      if (cues[mid].end >= timeMs) { result = mid; break; }
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

export function Showcase(): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatActive, setRepeatActive] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Seed cues store on mount
  useEffect(() => {
    const store = useCuesStore.getState();
    store.setCues(TARGET_CUES, NATIVE_CUES);
    store.setActiveIndex(-1, -1);
  }, []);

  // Sync video.currentTime → active cue index
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const timeMs = video.currentTime * 1000;
    const tIdx = findActiveIndex(TARGET_CUES, timeMs);
    const nIdx = findActiveIndex(NATIVE_CUES, timeMs);
    useCuesStore.getState().setActiveIndex(tIdx, nIdx);
  }, []);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  const handleSeek = useCallback((deltaSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 60, video.currentTime + deltaSec));
  }, []);

  const handleSeekTo = useCallback((timeMs: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = timeMs / 1000;
  }, []);

  const handlePrev = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const timeMs = video.currentTime * 1000;
    const prev = [...TARGET_CUES].reverse().find(c => c.end < timeMs);
    if (prev) video.currentTime = prev.start / 1000;
  }, []);

  const handleNext = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const timeMs = video.currentTime * 1000;
    const next = TARGET_CUES.find(c => c.start > timeMs);
    if (next) video.currentTime = next.start / 1000;
  }, []);

  return (
    <div className={styles.wrapper}>
      <div className={styles.playerFrame}>
        <video
          ref={videoRef}
          className={styles.video}
          src={helloMp4}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          controls
          playsInline
        />
        <div className={styles.overlayLayer}>
          <SubtitlePanels
            targetStyle={DEFAULT_OVERLAY_STYLE_TARGET}
            nativeStyle={DEFAULT_OVERLAY_STYLE_NATIVE}
            collapsed={collapsed}
            isPlaying={isPlaying}
            repeatActive={repeatActive}
            clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
            blockSettings={DEFAULT_SUBTITLE_BLOCK_SETTINGS}
            yOffsetPercent={75}
            onPrev={handlePrev}
            onNext={handleNext}
            onRepeat={() => setRepeatActive((v) => !v)}
            onRewind={() => handleSeek(-10)}
            onForward={() => handleSeek(10)}
            onPlayPause={handlePlayPause}
            onToggleCollapsed={() => setCollapsed((v) => !v)}
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
              apiKeys: [],
              onApiKeysChange: () => {},
              onSearchResultSelect: () => {},
            }}
            offset={{
              targetMs: 0,
              nativeMs: 0,
              onTargetChange: () => {},
              onNativeChange: () => {},
            }}
            generateNativeEnabled
            videoAspectRatio={16 / 9}
            cues={TARGET_CUES.map((t, i) => ({
              index: t.index,
              start: t.start,
              end: t.end,
              targetText: t.text,
              nativeText: NATIVE_CUES[i]?.text ?? '',
            }))}
            currentTimeMs={videoRef.current?.currentTime ? videoRef.current.currentTime * 1000 : 0}
            onSeek={handleSeekTo}
          />
        </div>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Video Player Test Page',
  description: 'Real video player (Hello — Adele) with injected bilingual subtitle overlay. SubtitlePanels mounted over <video> element, synced via timeupdate. NavCluster controls (prev/next/repeat/rewind/forward/play-pause) wired to video. Tests subtitle detection, overlay positioning, cue highlighting, and player controls in a realistic environment.',
  level: 'pages' as const,
  category: 'Video Player',
  order: 60,
};
