import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { Icon } from '@/shared/ui';
import { srtToVtt, VIDEOS } from './streamFlixData';
import type { MockVideo } from './streamFlixData';
import styles from './VideoPlayer.module.css';

type PlayerMode = 'same' | 'child';
type SubMode = 'hash' | 'track';
type SubLang = 'Off' | 'English' | 'Vietnamese' | 'DualSub';

export interface VideoPlayerProps {
  video: MockVideo;
  mode: PlayerMode;
  className?: string;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = h > 0 ? String(h * 60 + m).padStart(2, '0') : String(m).padStart(2, '0');
  return `${mm}:${String(s).padStart(2, '0')}`;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubbingRef = useRef(false);

  const childParams = mode === 'child' ? readChildParams() : null;
  const videoIndex = childParams?.videoIndex ?? 0;
  const activeVideo = mode === 'child' ? (VIDEOS[videoIndex] ?? propVideo) : propVideo;
  const subMode = childParams?.subMode ?? 'track';

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [subtitleLang, setSubtitleLang] = useState<SubLang>('English');

  const [vttUrl, setVttUrl] = useState<string | null>(null);

  useEffect(() => {
    const blob = new Blob([srtToVtt(activeVideo.cues)], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    setVttUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [activeVideo.cues]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setBufferedEnd(0);
    setIsPlaying(false);
    setIsBuffering(true);
  }, [activeVideo]);

  useEffect(() => {
    const onChange = (): void => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(videoRef.current?.currentTime ?? 0);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    setDuration(videoRef.current?.duration ?? 0);
    setIsBuffering(false);
  }, []);

  const handleProgress = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const ranges = v.buffered;
    setBufferedEnd(ranges.length ? ranges.end(ranges.length - 1) : 0);
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

  const handleSkip = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
  }, []);

  const seekFromClientX = useCallback((track: HTMLDivElement, clientX: number) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
  }, []);

  const handleProgressPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
    }
    scrubbingRef.current = true;
    setIsScrubbing(true);
    seekFromClientX(e.currentTarget, e.clientX);
  }, [seekFromClientX]);

  const handleProgressPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubbingRef.current) seekFromClientX(e.currentTarget, e.clientX);
  }, [seekFromClientX]);

  const handleProgressPointerEnd = useCallback(() => {
    scrubbingRef.current = false;
    setIsScrubbing(false);
  }, []);

  const handleProgressKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    if (e.key === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 5);
    else if (e.key === 'ArrowRight') v.currentTime = Math.min(v.duration, v.currentTime + 5);
    else if (e.key === 'Home') v.currentTime = 0;
    else if (e.key === 'End') v.currentTime = v.duration;
    else return;
    e.preventDefault();
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
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }, []);

  const toggleSubtitles = useCallback(() => {
    setSubtitleLang(l => (l === 'Off' ? 'English' : 'Off'));
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

  const activeCue = subMode === 'hash' && isPlaying && subtitleLang !== 'Off'
    ? activeVideo.cues.find(c => c.start <= currentTime * 1000 && c.end > currentTime * 1000)
    : undefined;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? Math.min((bufferedEnd / duration) * 100, 100) : 0;

  const volumeIcon = isMuted || volume === 0 ? 'volumeMute' : volume < 0.5 ? 'volumeLow' : 'volumeHigh';
  const subtitlesOn = subtitleLang !== 'Off';

  return (
    <div
      ref={containerRef}
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
          poster={activeVideo.thumb}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onProgress={handleProgress}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onCanPlay={handleCanPlay}
          playsInline
          disablePictureInPicture
          controlsList="nopictureinpicture"
          crossOrigin="anonymous"
          onClick={handlePlayPause}
        >
          {subMode === 'track' && subtitleLang !== 'Off' && vttUrl && (
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

      {showControls && !isBuffering && (
        <div className={styles.controlsLayer}>
          <div className={styles.topScrim}>
            <span className={styles.videoTitle}>{activeVideo.title}</span>
          </div>

          <div className={styles.bottomScrim}>
            <div
              className={styles.progress}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              tabIndex={0}
              data-scrubbing={isScrubbing || undefined}
              onPointerDown={handleProgressPointerDown}
              onPointerMove={handleProgressPointerMove}
              onPointerUp={handleProgressPointerEnd}
              onPointerCancel={handleProgressPointerEnd}
              onKeyDown={handleProgressKeyDown}
            >
              <div className={styles.progressTrack}>
                <div className={styles.progressBuffered} style={{ width: `${bufferedPct}%` }} />
                <div className={styles.progressPlayed} style={{ width: `${progressPct}%` }}>
                  <div className={styles.progressThumb} />
                </div>
              </div>
            </div>

            <div className={styles.controlsRow}>
              <button
                type="button"
                className={styles.ctrlBtn}
                onClick={handlePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                <Icon name={isPlaying ? 'pause' : 'play'} size="md" />
              </button>

              <button
                type="button"
                className={styles.ctrlBtn}
                onClick={() => handleSkip(-15)}
                aria-label="Back 15 seconds"
              >
                <Icon name="navRewind" size="md" />
              </button>

              <button
                type="button"
                className={styles.ctrlBtn}
                onClick={() => handleSkip(15)}
                aria-label="Forward 15 seconds"
              >
                <Icon name="navForward" size="md" />
              </button>

              <div className={styles.volumeGroup}>
                <button
                  type="button"
                  className={styles.ctrlBtn}
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  <Icon name={volumeIcon} size="md" />
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className={styles.volumeSlider}
                  style={{ '--vol': `${(isMuted ? 0 : volume) * 100}%` } as CSSProperties}
                  aria-label="Volume level"
                />
              </div>

              <span className={styles.time}>
                {formatTime(currentTime)}
                <span className={styles.timeTotal}> / {formatTime(duration)}</span>
              </span>

              <div className={styles.spacer} />

              <button
                type="button"
                className={styles.ctrlBtn}
                data-active={subtitlesOn || undefined}
                aria-pressed={subtitlesOn}
                onClick={toggleSubtitles}
                aria-label={subtitlesOn ? 'Hide subtitles' : 'Show subtitles'}
              >
                <Icon name="captions" size="md" />
              </button>

              <button
                type="button"
                className={styles.ctrlBtn}
                disabled
                aria-disabled="true"
                aria-label="Settings"
              >
                <Icon name="settings" size="md" />
              </button>

              <button
                type="button"
                className={styles.ctrlBtn}
                disabled
                aria-disabled="true"
                aria-label="Picture in picture"
              >
                <Icon name="pip" size="md" />
              </button>

              <button
                type="button"
                className={styles.ctrlBtn}
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                <Icon name={isFullscreen ? 'minimize' : 'maximize'} size="md" />
              </button>
            </div>
          </div>
        </div>
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
    </div>
  );
}
