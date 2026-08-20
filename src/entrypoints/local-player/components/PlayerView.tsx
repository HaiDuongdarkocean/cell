import { useCallback, useEffect, useRef, useState } from 'react';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { VideoRecord, SubtitleRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SubtitlesState, SubtitleStatus } from '@/entrypoints/local-player/hooks/useLocalPlayerStore';
import type { SortBy } from '@/features/local-player/logic/librarySort';
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';
import { useLocalVideo } from '@/entrypoints/local-player/hooks/useLocalVideo';
import type { SubtitleEngineControls } from '@/entrypoints/local-player/hooks/useSubtitleEngine';
import { SubtitlePanels } from '@/features/subtitle/ui/SubtitlePanels';
import { hostManagerSheetShadowCss } from '@/features/subtitle/ui/hostManagerSheetShadowCss';
import { handleShortcutKey, isEditableEvent } from '@/features/subtitle/ui/subtitleShortcuts';
import { ICON_CATALOG } from '@/shared/icons';
import type { SubtitleActionHandlers } from '@/entrypoints/local-player/hooks/useSubtitleActions';
import type { SubtitlePanelsRef, ManagerState } from '@/features/subtitle/ui/subtitlePanelsTypes';
import { useCuesStore } from '@/stores/cuesStore';
import type { BilingualCue, KeyboardShortcut, SrtCue } from '@/entities/media';
import {
  DEFAULT_NAV_CLUSTER_SETTINGS,
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_KEYBOARD_SHORTCUTS,
} from '@/shared/config/config';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { getStorage, setStorage } from '@/shared/lib/chrome-apis';
import { STORAGE_KEYS } from '@/shared/config/config';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import { PlayerMenuBar } from './PlayerMenuBar';
import { PlayerControls } from './PlayerControls';
import { PlayPauseOverlay } from './PlayPauseOverlay';
import { EmptyState } from './EmptyState';
import { LibraryView } from './LibraryView';
import { TrackSelector } from './TrackSelector';
import styles from './PlayerView.module.css';

export interface PlayerViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoFile: File | null;
  filename: string | null;
  subtitles: SubtitlesState;
  subtitleStatus: SubtitleStatus;
  library: VideoRecord[];
  subtitlesLibrary: SubtitleRecord[];
  librarySort: SortBy;
  showLibrary: boolean;
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onOpenSubtitle: () => void;
  onSelectTrack: (match: SubtitleMatch) => void;
  onFilesDrop: (files: File[]) => void;
  onToggleLibrary: () => void;
  onVideoSelect: (videoId: string) => void;
  onSubtitleSelect: (subtitleId: string) => void;
  onSortChange: (sortBy: SortBy) => void;
  onTimeUpdate?: (currentTime: number) => void;
  subtitleEngine: SubtitleEngineControls;
  /** Manager state for subtitle track switching. Built by main.tsx from SubtitlesState. */
  manager: ManagerState;
  /** Card/dictionary/generate-native handlers from useSubtitleActions. */
  subtitleActions: SubtitleActionHandlers;
  /** Whether a previous video is available in the library. */
  hasPrevVideo?: boolean;
  /** Whether a next video is available in the library. */
  hasNextVideo?: boolean;
  /** Load the previous video from the library. */
  onPrevVideo?: () => void;
  /** Load the next video from the library. */
  onNextVideo?: () => void;
}

type SkipDirection = 'forward' | 'backward';

/** Merge target + native SrtCue[] into BilingualCue[] for CueList. */
function buildBilingualCues(target: readonly SrtCue[], native: readonly SrtCue[]): BilingualCue[] {
  if (target.length === 0) return [];
  if (native.length === 0) {
    return target.map((c) => ({ index: c.index, start: c.start, end: c.end, targetText: c.text, nativeText: '' }));
  }
  // ponytail: naive O(n) merge by index — cues are aligned 1:1 in bilingual SRT.
  // Ceiling: misaligned cues (different timing) show empty native text. Upgrade: merge by time overlap.
  return target.map((c, i) => ({
    index: c.index,
    start: c.start,
    end: c.end,
    targetText: c.text,
    nativeText: native[i]?.text ?? '',
  }));
}

/**
 * PlayerView — top-level layout of the local player page.
 *
 * Stack: PlayerMenuBar (top) → video stage (center, fills remaining space) →
 * PlayerControls (bottom). The video stage swaps between EmptyState (no file)
 * and the `<video>` element (file loaded). A SubtitleBlock overlay sits on top
 * of the video when target subtitles are matched. The LibraryView slides in
 * from the right as an overlay panel when `showLibrary` is true.
 *
 * Playback state + imperative controls come from `useLocalVideo`, which is
 * wired to the shared `videoRef` so the parent can drive resume positioning.
 */
export function PlayerView({
  videoRef,
  videoFile,
  filename,
  subtitles,
  subtitleStatus,
  library,
  subtitlesLibrary,
  librarySort,
  showLibrary,
  targetStyle,
  nativeStyle,
  onOpenFile,
  onOpenFolder,
  onOpenSubtitle,
  onSelectTrack,
  onFilesDrop,
  onToggleLibrary,
  onVideoSelect,
  onSubtitleSelect,
  onSortChange,
  onTimeUpdate,
  subtitleEngine,
  manager,
  subtitleActions,
  hasPrevVideo = false,
  hasNextVideo = false,
  onPrevVideo,
  onNextVideo,
}: PlayerViewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const subtitlePanelsRef = useRef<SubtitlePanelsRef>(null);
  const controls = useLocalVideo(videoRef, containerRef, { onTimeUpdate, videoFile, autoPlay: true });
  const [showTrackSelector, setShowTrackSelector] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [flashPulse, setFlashPulse] = useState(0);
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause'>('play');
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shortcutsRef = useRef<KeyboardShortcut[]>(DEFAULT_KEYBOARD_SHORTCUTS);

  // Read cues from the global cuesStore (driven by SubtitleCueEngine).
  const targetCues = useCuesStore((s) => s.targetCues);
  const nativeCues = useCuesStore((s) => s.nativeCues);

  const hasVideo = videoFile !== null;
  const hasSubtitles = subtitleEngine.hasSubtitles && targetCues.length > 0;
  // SubtitlePanels renders whenever a video is loaded — even without subtitles,
  // so the overlay panel (split view, manager, tools) stays accessible.
  const showSubtitlePanels = hasVideo;
  const showNoSubtitle = subtitleStatus === 'not-found' && hasVideo && !hasSubtitles;
  const showSubtitleError = subtitleStatus === 'error' && hasVideo && !hasSubtitles;

  // ponytail ceiling: storage write after load won't reflect until reload.
  // Upgrade: onStorageChanged listener (like sidepanel).
  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const settings = await loadSettings();
        if (cancelled) return;
        if (settings.keyboardShortcuts?.length) {
          shortcutsRef.current = settings.keyboardShortcuts;
        }
      } catch {
        // Storage unavailable (e.g. test env) — keep defaults.
      }
    })();
    return (): void => { cancelled = true; };
  }, []);

  // Flash center play/pause icon on toggle (covers click + Space + any source).
  const prevPlayingRef = useRef(controls.isPlaying);
  useEffect(() => {
    if (prevPlayingRef.current === controls.isPlaying) return;
    prevPlayingRef.current = controls.isPlaying;
    setFlashIcon(controls.isPlaying ? 'pause' : 'play');
    setFlashPulse((n) => n + 1);
  }, [controls.isPlaying]);

  // Auto-hide controls (YouTube-style): show on mousemove, hide after 3s idle.
  // Paused state always shows controls so user can see the play button.
  const showControls = useCallback((): void => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (controls.isPlaying) setControlsVisible(false);
    }, 3000);
  }, [controls.isPlaying]);

  useEffect(() => {
    if (!hasVideo) return;
    const wrapper = containerRef.current;
    if (!wrapper) return;
    const handleMove = (): void => showControls();
    const handleEnter = (): void => showControls();
    const handleLeave = (): void => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (controls.isPlaying) setControlsVisible(false);
    };
    wrapper.addEventListener('mousemove', handleMove);
    wrapper.addEventListener('mouseenter', handleEnter);
    wrapper.addEventListener('mouseleave', handleLeave);
    return (): void => {
      wrapper.removeEventListener('mousemove', handleMove);
      wrapper.removeEventListener('mouseenter', handleEnter);
      wrapper.removeEventListener('mouseleave', handleLeave);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [hasVideo, showControls, controls.isPlaying]);

  // When paused, always show controls; when playing resumes, restart hide timer.
  useEffect(() => {
    if (!controls.isPlaying) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    } else {
      showControls();
    }
  }, [controls.isPlaying, showControls]);

  // Restore subtitle-panel (Split View) enable state from previous session.
  // Default disable — only open if user explicitly enabled before. Runs once
  // after SubtitlePanels mounts (which requires a loaded video).
  const restoredPanelPrefRef = useRef(false);
  useEffect(() => {
    if (!showSubtitlePanels || restoredPanelPrefRef.current) return;
    restoredPanelPrefRef.current = true;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const data = await getStorage<Record<string, unknown>>(STORAGE_KEYS.LOCAL_PLAYER_SUBTITLE_PANEL_OPEN);
        if (cancelled) return;
        if (data[STORAGE_KEYS.LOCAL_PLAYER_SUBTITLE_PANEL_OPEN] === true) {
          subtitlePanelsRef.current?.setSplitViewOpen(true);
        }
      } catch {
        // Storage unavailable (e.g. test env) — keep default disable.
      }
    })();
    return (): void => { cancelled = true; };
  }, [showSubtitlePanels]);

  // Persist subtitle-panel enable state when user toggles it.
  const handleSplitViewChange = useCallback((open: boolean): void => {
    void setStorage({ [STORAGE_KEYS.LOCAL_PLAYER_SUBTITLE_PANEL_OPEN]: open }).catch(() => undefined);
  }, []);

  // Set video.src when a new file is loaded.
  useEffect(() => {
    if (!videoFile) return;
    const video = videoRef.current;
    if (!video) return;
    const url = URL.createObjectURL(videoFile);
    const prevSrc = video.src;
    video.src = url;
    video.load();
    return (): void => {
      URL.revokeObjectURL(url);
      if (prevSrc) URL.revokeObjectURL(prevSrc);
    };
  }, [videoFile, videoRef]);

  const handleSkip = (direction: SkipDirection, seconds: number): void => {
    const video = videoRef.current;
    if (!video) return;
    controls.seek(direction === 'forward' ? video.currentTime + seconds : video.currentTime - seconds);
  };

  const handleVideoClick = (): void => {
    if (controls.isPlaying) controls.pause();
    else controls.play();
  };

  // Clicks pass through .subtitleOverlay (pointer-events:none) so this fires
  // even when the overlay is showing. Window listener (not container) because
  // <video> is not focusable — a container listener would miss focus=body.
  // Skip 'play-pause' (useLocalVideo handles Space → avoid double-toggle).
  // Skip 'toggle-player-mode' + 'toggle-translate' (host-page-only, ADR-078).
  useEffect(() => {
    const onKeydown = (e: KeyboardEvent): void => {
      if (isEditableEvent(e)) return;
      const action = handleShortcutKey(
        e.key.toLowerCase(),
        shortcutsRef.current,
        e.target,
        { ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey },
      );
      if (!action) return;
      if (action === 'play-pause' || action === 'toggle-player-mode' || action === 'toggle-translate') return;

      e.preventDefault();
      switch (action) {
        case 'prev-cue': subtitleEngine.prev(); break;
        case 'next-cue': subtitleEngine.next(); break;
        case 'replay-cue': subtitleEngine.repeat(); break;
        case 'toggle-overlay': setOverlayVisible((v) => !v); break;
        case 'toggle-panel': subtitlePanelsRef.current?.toggleSplitView(); break;
        case 'generate-native': subtitleActions.onGenerateNative?.(); break;
        case 'quick-update': subtitleActions.onQuickAdd?.(); break;
        case 'edit-card': subtitleActions.onEditCard?.(); break;
      }
    };
    window.addEventListener('keydown', onKeydown);
    return (): void => window.removeEventListener('keydown', onKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitleEngine, subtitleActions]);

  const effectiveTargetStyle: OverlayStyleConfig = { ...targetStyle, visible: overlayVisible };
  const effectiveNativeStyle: OverlayStyleConfig = { ...nativeStyle, visible: overlayVisible };

  return (
    <div className={styles.root} ref={containerRef} data-cell-id="player-view">
      <PlayerMenuBar
        filename={filename}
        isLibraryOpen={showLibrary}
        onOpenFile={onOpenFile}
        onToggleLibrary={onToggleLibrary}
      />

      <div className={styles.stage} data-cell-id="video-stage">
        {hasVideo ? (
          <div className={styles.videoWrapper}>
            <video
              ref={videoRef}
              className={styles.video}
              playsInline
              onClick={handleVideoClick}
            />

            {flashPulse > 0 && (
              <PlayPauseOverlay icon={flashIcon} pulseKey={flashPulse} />
            )}

            {showSubtitlePanels && (
              <div className={styles.subtitleOverlay}>
                <SubtitlePanels
                  ref={subtitlePanelsRef}
                  targetStyle={effectiveTargetStyle}
                  nativeStyle={effectiveNativeStyle}
                  collapsed={false}
                  isPlaying={controls.isPlaying}
                  repeatActive={subtitleEngine.repeatActive}
                  repeatIcon={subtitleEngine.repeatIcon as keyof typeof ICON_CATALOG | undefined}
                  repeatLabel={subtitleEngine.repeatLabel}
                  clusterSettings={DEFAULT_NAV_CLUSTER_SETTINGS}
                  blockSettings={DEFAULT_SUBTITLE_BLOCK_SETTINGS}
                  yOffsetPercent={75}
                  onPrev={subtitleEngine.prev}
                  onNext={subtitleEngine.next}
                  onRepeat={subtitleEngine.repeat}
                  onRewind={subtitleEngine.rewind}
                  onForward={subtitleEngine.forward}
                  onPlayPause={subtitleEngine.playPause}
                  onToggleCollapsed={() => {}}
                  onToggleSidePanel={() => {}}
                  onQuickAdd={subtitleActions.onQuickAdd}
                  onEditCard={subtitleActions.onEditCard}
                  onUpdateCurrentCard={subtitleActions.onUpdateCurrentCard}
                  onToggleManager={() => subtitlePanelsRef.current?.setManagerOpen(true)}
                  onGenerateNative={subtitleActions.onGenerateNative}
                  generateNativeEnabled={subtitleActions.generateNativeEnabled}
                  manager={manager}
                  cues={buildBilingualCues(targetCues, nativeCues)}
                  currentTimeMs={controls.currentTime * 1000}
                  offsetMs={subtitleEngine.offsetMs}
                  onSeek={(ms) => controls.seek(ms / 1000)}
                  onSplitViewChange={handleSplitViewChange}
                  managerShadowCss={hostManagerSheetShadowCss}
                />
              </div>
            )}

            {showNoSubtitle && (
              <div className={styles.noSubtitleBanner} data-cell-id="no-subtitle-banner">
                <Icon name="captions" size={20} />
                <span>No subtitle found</span>
                <Button variant="secondary" size="sm" onClick={onOpenSubtitle} leadingIcon={<Icon name="fileVideo" size={16} />}>
                  Open subtitle file
                </Button>
              </div>
            )}

            {showSubtitleError && (
              <div className={styles.noSubtitleBanner} data-cell-id="subtitle-error-banner">
                <Icon name="triangleAlert" size={16} />
                <span>Subtitle access unavailable on this browser</span>
                <Button variant="secondary" size="sm" onClick={onOpenSubtitle} leadingIcon={<Icon name="fileVideo" size={16} />}>
                  Open subtitle file
                </Button>
              </div>
            )}

            {showTrackSelector && subtitles.others.length > 0 && (
              <TrackSelector
                currentTarget={subtitles.target?.filename ?? null}
                currentNative={subtitles.native?.filename ?? null}
                options={[subtitles.target, subtitles.native, ...subtitles.others].filter(Boolean) as SubtitleMatch[]}
                onSelectTrack={(m) => {
                  onSelectTrack(m);
                  setShowTrackSelector(false);
                }}
              />
            )}

            <div className={styles.controlsOverlay} data-cell-id="controls-overlay"
              data-visible={controlsVisible}
              style={{ opacity: controlsVisible ? '1' : '0', pointerEvents: controlsVisible ? 'auto' : 'none' }}
            >
              <PlayerControls
                isPlaying={controls.isPlaying}
                currentTime={controls.currentTime}
                duration={controls.duration}
                volume={controls.volume}
                muted={controls.muted}
                playbackRate={controls.playbackRate}
                isHidden={!hasVideo}
                captionsOn={captionsOn}
                captionsAvailable={hasSubtitles}
                onToggleCaptions={() => setCaptionsOn((v) => !v)}
                onToggleTrackSelector={() => setShowTrackSelector((v) => !v)}
                hasMultipleTracks={subtitles.others.length > 0}
                onPlayPause={() => (controls.isPlaying ? controls.pause() : controls.play())}
                onSeek={controls.seek}
                onVolumeChange={controls.setVolume}
                onMuteToggle={controls.toggleMute}
                onSpeedChange={controls.setPlaybackRate}
                onToggleFullscreen={controls.toggleFullscreen}
                onTogglePiP={controls.togglePiP}
                onSkip={handleSkip}
                hasPrevVideo={hasPrevVideo}
                hasNextVideo={hasNextVideo}
                onPrevVideo={onPrevVideo}
                onNextVideo={onNextVideo}
              />
            </div>
          </div>
        ) : (
          <EmptyState onOpenFile={onOpenFile} onOpenFolder={onOpenFolder} onFilesDrop={onFilesDrop} />
        )}

        {showLibrary && (
          <aside className={styles.libraryPanel} data-cell-id="library-panel">
            <LibraryView
              videos={library}
              subtitles={subtitlesLibrary}
              sortBy={librarySort}
              onSortChange={onSortChange}
              onVideoSelect={onVideoSelect}
              onSubtitleSelect={onSubtitleSelect}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
