import { useEffect, useRef, useState } from 'react';
import {
  CaptionsButton,
  FullscreenButton,
  PiPButton,
  PlaybackSpeedControl,
  PlayPauseButton,
  SkipButton,
  TimeDisplay,
  Timeline,
  VolumeControl,
} from '@/shared/domain/video/atoms';
import { Button } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import styles from './PlayerControls.module.css';

type SkipDirection = 'forward' | 'backward';

interface PlayerControlsProps {
  /** Controlled playback state. true = playing. */
  isPlaying: boolean;
  /** Current playback position in seconds. */
  currentTime: number;
  /** Total media duration in seconds. */
  duration: number;
  /** Volume level 0–1. */
  volume: number;
  /** Muted state (controlled). */
  muted: boolean;
  /** Current playback speed (e.g. 1, 1.5). */
  playbackRate: number;
  /** Seconds buffered ahead of currentTime. Default 0. */
  buffered?: number;
  /** Fullscreen state — toggles FullscreenButton icon/aria. Default false. */
  isFullscreen?: boolean;
  /** Picture-in-picture state — toggles PiPButton icon/aria. Default false. */
  isPiP?: boolean;
  /** Hide the whole bar (no video loaded). Default false. */
  isHidden?: boolean;
  /** Whether captions are currently visible. */
  captionsOn?: boolean;
  /** Whether captions track is available. */
  captionsAvailable?: boolean;
  /** Toggle captions display. */
  onToggleCaptions?: () => void;
  /** Toggle subtitle track selector. */
  onToggleTrackSelector?: () => void;
  /** Whether multiple subtitle tracks are available. */
  hasMultipleTracks?: boolean;
  /** Toggle play/pause. */
  onPlayPause: () => void;
  /** Seek to an absolute time (seconds). */
  onSeek: (time: number) => void;
  /** New volume (0–1). */
  onVolumeChange: (volume: number) => void;
  /** Toggle mute. */
  onMuteToggle: () => void;
  /** New playback speed. */
  onSpeedChange: (speed: number) => void;
  /** Toggle fullscreen. */
  onToggleFullscreen: () => void;
  /** Toggle picture-in-picture. */
  onTogglePiP: () => void;
  /** Skip forward/backward by `seconds`. */
  onSkip: (direction: SkipDirection, seconds: number) => void;
  /** Whether a previous video is available in the library. */
  hasPrevVideo?: boolean;
  /** Whether a next video is available in the library. */
  hasNextVideo?: boolean;
  /** Load the previous video from the library. */
  onPrevVideo?: () => void;
  /** Load the next video from the library. */
  onNextVideo?: () => void;
}

const SKIP_SECONDS = 10;

/**
 * PlayerControls — bottom control bar of the local player.
 *
 * Two-row layout (fixes small-screen overflow — seek bar gets its own full-width row):
 * - Row 1: Timeline (seek bar), full-width
 * - Row 2: two pill clusters on a transparent bar
 *   - Left pill: play/pause + skip ±10s + volume (hover→slider) + time
 *   - Right pill: captions + settings popover (speed, track selector) + PiP + fullscreen
 *
 * Settings popover groups secondary controls (speed, track selector) so the bar
 * stays compact on narrow viewports. Subtitle offset lives in the subtitle
 * manager, not here.
 */
export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  playbackRate,
  buffered = 0,
  isFullscreen = false,
  isPiP = false,
  isHidden = false,
  captionsOn = false,
  captionsAvailable = false,
  onToggleCaptions,
  onToggleTrackSelector,
  hasMultipleTracks = false,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onSpeedChange,
  onToggleFullscreen,
  onTogglePiP,
  onSkip,
  hasPrevVideo = false,
  hasNextVideo = false,
  onPrevVideo,
  onNextVideo,
}: PlayerControlsProps): React.JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const handlePointerDown = (e: MouseEvent): void => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [settingsOpen]);

  const hasSettingsItems = hasMultipleTracks && !!onToggleTrackSelector;

  return (
    <div
      className={styles.bar}
      data-cell-id="player-controls"
      hidden={isHidden || undefined}
    >
      <div className={styles.seekRow}>
        <Timeline
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          onSeek={onSeek}
        />
      </div>

      <div className={styles.controlsRow}>
        <div className={styles.pillLeft}>
          {onPrevVideo && (
            <Button shape="circle" material="solid"
              aria-label="Previous video"
              title="Previous video"
              disabled={!hasPrevVideo}
              onClick={onPrevVideo}
            >
              <Icon name="chevronLeft" />
            </Button>
          )}
          <PlayPauseButton playing={isPlaying} onClick={onPlayPause} />
          {onNextVideo && (
            <Button shape="circle" material="solid"
              aria-label="Next video"
              title="Next video"
              disabled={!hasNextVideo}
              onClick={onNextVideo}
            >
              <Icon name="chevronRight" />
            </Button>
          )}
          <SkipButton
            direction="backward"
            seconds={SKIP_SECONDS}
            onClick={() => onSkip('backward', SKIP_SECONDS)}
          />
          <SkipButton
            direction="forward"
            seconds={SKIP_SECONDS}
            onClick={() => onSkip('forward', SKIP_SECONDS)}
          />
          <VolumeControl
            volume={volume}
            muted={muted}
            onVolumeChange={onVolumeChange}
            onMuteToggle={onMuteToggle}
            collapsible
          />
          <TimeDisplay currentTime={currentTime} duration={duration} />
        </div>

        <div className={styles.pillRight}>
          {onToggleCaptions && (
            <CaptionsButton
              captionsOn={captionsOn}
              available={captionsAvailable}
              onClick={onToggleCaptions}
            />
          )}
          {hasSettingsItems && (
            <div className={styles.settingsWrap} ref={settingsRef}>
              <Button shape="circle" material="solid"
                aria-label="Settings"
                aria-haspopup="menu"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((p) => !p)}
                title="Settings"
              >
                <Icon name="settings" />
              </Button>
              {settingsOpen && (
                <div className={styles.settingsMenu} role="menu">
                  <div className={styles.settingsItem}>
                    <PlaybackSpeedControl
                      currentSpeed={playbackRate}
                      onSpeedChange={onSpeedChange}
                    />
                  </div>
                  {hasMultipleTracks && onToggleTrackSelector && (
                    <Button material="solid" variant="secondary"
                      role="menuitem"
                      className={styles.settingsMenuItem}
                      onClick={() => {
                        onToggleTrackSelector();
                        setSettingsOpen(false);
                      }}
                    >
                      <Icon name="languages" className={styles.settingsMenuIcon} />
                      <span>Tracks</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          <PiPButton pip={isPiP} onClick={onTogglePiP} />
          <FullscreenButton
            fullscreen={isFullscreen}
            onClick={onToggleFullscreen}
          />
        </div>
      </div>
    </div>
  );
}
