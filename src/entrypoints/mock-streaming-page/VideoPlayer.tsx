import {
  useCallback,
  useEffect,
  useRef,
  useState,
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
  const [subtitleLang] = useState<SubLang>('English');

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

  const handleSkip = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
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
  const remaining = Math.max(0, duration - currentTime);

  const volumeIcon = isMuted || volume === 0 ? 'volumeMute' : volume < 0.5 ? 'volumeLow' : 'volumeHigh';

  const glassPill = styles.glassPill;
  const glassCircle = styles.glassCircle;

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
          poster={activeVideo.thumb}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
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

      {!isPlaying && !isBuffering && (
        <button
          type="button"
          className={styles.playMask}
          onClick={handlePlayPause}
          aria-label="Play"
          tabIndex={-1}
        >
          <span className={`${glassCircle} ${styles.playCircle}`}>
            <Icon name="play" size="lg" />
          </span>
        </button>
      )}

      {showControls && !isBuffering && (
        <>
          <div className={styles.topControls}>
            <div className={styles.topLeft}>
              <button
                type="button"
                className={`${glassCircle} ${styles.closeBtn}`}
                onClick={() => window.history.back()}
                aria-label="Close"
              >
                <Icon name="x" size="sm" />
              </button>

              <div className={`${glassPill} ${styles.topPill}`}>
                <button type="button" className={styles.topPillBtn} aria-label="Picture in picture" disabled aria-disabled="true">
                  <Icon name="pip" size="sm" />
                </button>
                <button type="button" className={styles.topPillBtn} aria-label="Cast" disabled aria-disabled="true">
                  <Icon name="maximize" size="sm" />
                </button>
                <button type="button" className={styles.topPillBtn} aria-label="Share" disabled aria-disabled="true">
                  <Icon name="externalLink" size="sm" />
                </button>
              </div>
            </div>

            <div className={styles.topRight}>
              <div className={`${glassPill} ${styles.volumePill}`}>
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
                <button type="button" className={styles.volumeIconBtn} onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
                  <Icon name={volumeIcon} size="sm" />
                </button>
              </div>
            </div>
          </div>

          <div className={styles.centerOverlay}>
            <div className={styles.centerGroup}>
              <button
                type="button"
                className={`${glassCircle} ${styles.skipCircle}`}
                onClick={(e) => { e.stopPropagation(); handleSkip(-15); }}
                aria-label="Skip back 15 seconds"
              >
                <Icon name="navRewind" size="md" />
                <span className={styles.skipLabel}>15</span>
              </button>

              <button
                type="button"
                className={`${glassCircle} ${styles.playCircle}`}
                onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                <Icon name={isPlaying ? 'pause' : 'play'} size="lg" />
              </button>

              <button
                type="button"
                className={`${glassCircle} ${styles.skipCircle}`}
                onClick={(e) => { e.stopPropagation(); handleSkip(15); }}
                aria-label="Skip forward 15 seconds"
              >
                <Icon name="navForward" size="md" />
                <span className={styles.skipLabel}>15</span>
              </button>
            </div>
          </div>

          <div className={styles.bottomControls}>
            <div className={styles.bottomLeft}>
              <div className={`${glassPill} ${styles.progressPill}`}>
                <span className={styles.timeCurrent}>{formatTime(currentTime)}</span>
                <div className={styles.progress} onClick={handleProgressClick}>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressBuffered} style={{ width: `${Math.min(progressPct + 5, 100)}%` }} />
                    <div className={styles.progressPlayed} style={{ width: `${progressPct}%` }}>
                      <div className={styles.progressThumb} />
                    </div>
                  </div>
                </div>
                <span className={styles.timeRemaining}>-{formatTime(remaining)}</span>
              </div>
            </div>

            <div className={styles.bottomRight}>
              <div className={`${glassPill} ${styles.actionPill}`}>
                <button type="button" className={styles.actionPillBtn} aria-label="Audio waveform" disabled aria-disabled="true">
                  <Icon name="audioWave" size="sm" />
                </button>
                <button type="button" className={styles.actionPillBtn} aria-label="Comments" disabled aria-disabled="true">
                  <Icon name="messageSquare" size="sm" />
                </button>
              </div>
            </div>
          </div>
        </>
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
