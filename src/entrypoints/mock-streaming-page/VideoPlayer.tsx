import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Icon, IconButton, Select } from '@/shared/ui';
import { srtToVtt, VIDEOS } from './streamFlixData';
import type { MockVideo } from './streamFlixData';
import styles from './VideoPlayer.module.css';

type PlayerMode = 'same' | 'child';
type SubMode = 'hash' | 'track';
type Quality = '480P' | '720P' | '1080P' | 'Auto';
type SubLang = 'Off' | 'English' | 'Vietnamese' | 'DualSub';

export interface VideoPlayerProps {
  video: MockVideo;
  mode: PlayerMode;
  className?: string;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function readChildParams(): { videoIndex: number; subMode: SubMode } {
  const params = new URLSearchParams(window.location.search);
  const v = Number(params.get('v') ?? '0');
  const m = params.get('mode');
  return {
    videoIndex: Number.isFinite(v) && v >= 0 && v < VIDEOS.length ? v : 0,
    subMode: m === 'track' ? 'track' : 'hash',
  };
}

export function VideoPlayer({ video: propVideo, mode, className }: VideoPlayerProps): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const childParams = mode === 'child' ? readChildParams() : null;
  const videoIndex = childParams?.videoIndex ?? 0;
  const activeVideo = mode === 'child' ? (VIDEOS[videoIndex] ?? propVideo) : propVideo;
  const subMode = childParams?.subMode ?? 'track';

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subtitleLang, setSubtitleLang] = useState<SubLang>('English');
  const [quality, setQuality] = useState<Quality>('480P');

  const vttUrl = useMemo(
    () => URL.createObjectURL(new Blob([srtToVtt(activeVideo.cues)], { type: 'text/vtt' })),
    [activeVideo],
  );

  useEffect(() => () => URL.revokeObjectURL(vttUrl), [vttUrl]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsBuffering(true);
  }, [activeVideo]);

  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(videoRef.current?.currentTime ?? 0);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    setDuration(videoRef.current?.duration ?? 0);
    setIsBuffering(false);
  }, []);

  const handleWaiting = useCallback(() => setIsBuffering(true), []);
  const handlePlaying = useCallback(() => setIsBuffering(false), []);
  const handleCanPlay = useCallback(() => setIsBuffering(false), []);

  const handlePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = Math.max(0, Math.min(v.duration, pct * v.duration));
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const vol = Number(e.target.value);
    v.volume = vol;
    v.muted = vol === 0;
    setVolume(vol);
    setIsMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const wrap = videoRef.current?.parentElement?.parentElement;
    if (!wrap) return;
    if (!document.fullscreenElement) {
      void wrap.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) setShowControls(true);
    showControlsTemporarily();
  }, [isPlaying, showControlsTemporarily]);

  const activeCue = subMode === 'track' && isPlaying && subtitleLang !== 'Off'
    ? activeVideo.cues.find(c => c.start <= currentTime * 1000 && c.end >= currentTime * 1000)
    : undefined;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const volumeIcon = isMuted || volume === 0 ? 'volumeMute' : volume < 0.5 ? 'volumeLow' : 'volumeHigh';

  const subOptions: { value: SubLang; label: string }[] = [
    { value: 'Off', label: 'Off' },
    { value: 'English', label: 'English' },
    { value: 'Vietnamese', label: 'Vietnamese' },
    { value: 'DualSub', label: 'DualSub' },
  ];

  const qualityOptions: { value: Quality; label: string }[] = [
    { value: '480P', label: '480P' },
    { value: '720P', label: '720P' },
    { value: '1080P', label: '1080P' },
    { value: 'Auto', label: 'Auto' },
  ];

  return (
    <div
      className={`player-container ${styles.playerContainer} ${isPlaying ? styles.playing : ''} ${showControls ? styles.controlsVisible : ''} ${isBuffering ? styles.buffering : ''} ${className ?? ''}`}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      id="player-wrapper"
    >
      <div className={styles.videoWrap}>
        <video
          ref={videoRef}
          className={styles.videoElement}
          src={activeVideo.mp4}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onCanPlay={handleCanPlay}
          playsInline
          crossOrigin="anonymous"
          onClick={handlePlayPause}
        >
          {subMode === 'track' && subtitleLang !== 'Off' && (
            <track
              kind="subtitles"
              src={vttUrl}
              srcLang="en"
              label={subtitleLang}
              default
            />
          )}
        </video>
      </div>

      {isBuffering && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      )}

      {!isPlaying && !isBuffering && (
        <button
          type="button"
          className={styles.mask}
          onClick={handlePlayPause}
          aria-label="Play"
        >
          <span className={styles.state}>
            <Icon name="play" size="lg" />
          </span>
        </button>
      )}

      {activeCue && (
        <div className={styles.subtitleOverlay} aria-live="polite">
          {activeCue.text}
        </div>
      )}

      {mode === 'child' && (
        <div className={styles.modeBadge} data-mode={subMode}>
          iframe player · {subMode}
        </div>
      )}

      {showControls && (
        <div className={styles.controls}>
          <div className={styles.progress} onClick={handleProgressClick}>
            <div className={styles.progressTrack}>
              <div className={styles.progressBuffered} style={{ width: `${Math.min(progressPct + 5, 100)}%` }} />
              <div className={styles.progressPlayed} style={{ width: `${progressPct}%` }}>
                <div className={styles.progressThumb} />
              </div>
            </div>
          </div>

          <div className={styles.controlsBar}>
            <div className={styles.controlsLeft}>
              <IconButton material="solid"
                variant="transparent"
                size="md"
                onClick={handlePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className={styles.controlBtn}
              >
                <Icon name={isPlaying ? 'pause' : 'play'} size="sm" />
              </IconButton>

              <div className={styles.volumeGroup}>
                <IconButton material="solid"
                  variant="transparent"
                  size="md"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                  className={styles.controlBtn}
                >
                  <Icon name={volumeIcon} size="sm" />
                </IconButton>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className={styles.volumeSlider}
                  aria-label="Volume level"
                />
              </div>

              <span className={styles.timeDisplay}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className={styles.controlsRight}>
              <Select
                value={subtitleLang}
                onChange={(v) => setSubtitleLang(v as SubLang)}
                options={subOptions}
                className={styles.controlSelect}
                aria-label="Subtitle language"
                menuAlign="right"
              />

              <Select
                value={quality}
                onChange={(v) => setQuality(v as Quality)}
                options={qualityOptions}
                className={styles.controlSelect}
                aria-label="Video quality"
                menuAlign="right"
              />

              <IconButton material="solid"
                variant="transparent"
                size="md"
                aria-label="Settings"
                className={styles.controlBtn}
              >
                <Icon name="slidersHorizontal" size="sm" />
              </IconButton>

              <IconButton material="solid"
                variant="transparent"
                size="md"
                aria-label="Picture in picture"
                className={styles.controlBtn}
              >
                <Icon name="pip" size="sm" />
              </IconButton>

              <IconButton material="solid"
                variant="transparent"
                size="md"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                className={styles.controlBtn}
              >
                <Icon name={isFullscreen ? 'minimize' : 'maximize'} size="sm" />
              </IconButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
