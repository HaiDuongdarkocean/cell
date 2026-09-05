import { useEffect, useRef, useState, useCallback, type ReactElement } from 'react';
import type { SrtCue } from '@/entities/media';
import styles from './YouTubePlayer.module.css';

interface YouTubePlayerProps {
  readonly mp4: string;
  readonly cues: readonly SrtCue[];
  readonly title: string;
}

function srtToVtt(cues: readonly SrtCue[]): string {
  const lines = ['WEBVTT', ''];
  for (const c of cues) {
    const start = msToVttTime(c.start);
    const end = msToVttTime(c.end);
    lines.push(String(c.index), `${start} --> ${end}`, c.text, '');
  }
  return lines.join('\n');
}

function msToVttTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mmm = Math.floor(ms % 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(mmm).padStart(3, '0')}`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** YouTube-style custom video player with overlay controls. */
export function YouTubePlayer({ mp4, cues, title }: YouTubePlayerProps): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [ccOn, setCcOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  const vttUrl = useRef<string>('');
  useEffect(() => {
    vttUrl.current = URL.createObjectURL(new Blob([srtToVtt(cues)], { type: 'text/vtt' }));
    return () => URL.revokeObjectURL(vttUrl.current);
  }, [cues]);

  // Sync state with video element
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(v.currentTime);
    const onLoadedMetadata = () => setDuration(v.duration);
    const onProgress = () => {
      if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onVolumeChange = () => { setVolume(v.volume); setMuted(v.muted); };
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('progress', onProgress);
    v.addEventListener('volumechange', onVolumeChange);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('progress', onProgress);
      v.removeEventListener('volumechange', onVolumeChange);
    };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Auto-hide controls
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (isPlaying) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => { resetHideTimer(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, [isPlaying, resetHideTimer]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const seek = useCallback((fraction: number) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = fraction * v.duration;
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  }, []);

  const toggleCc = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const track = v.textTracks[0];
    if (track) {
      track.mode = ccOn ? 'hidden' : 'showing';
      setCcOn(!ccOn);
    }
  }, [ccOn]);

  const changeRate = useCallback((rate: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'KeyM') toggleMute();
      else if (e.code === 'KeyF') toggleFullscreen();
      else if (e.code === 'KeyC') toggleCc();
      else if (e.key === 'Escape' && showSettings) setShowSettings(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, toggleMute, toggleFullscreen, toggleCc, showSettings]);

  const onSeekKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-5); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(5); }
    else if (e.key === 'Home') { e.preventDefault(); seek(0); }
    else if (e.key === 'End') { e.preventDefault(); seek(1); }
  }, [seekBy, seek]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`${styles.playerContainer} ${isFullscreen ? styles.fullscreen : ''}`}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={togglePlay}
      onDoubleClick={toggleFullscreen}
      role="region"
      aria-label={`Video player: ${title}`}
    >
      <video
        ref={videoRef}
        className={styles.playerVideo}
        src={mp4}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        onClick={(e) => e.stopPropagation()}
      >
        <track kind="subtitles" src={vttUrl.current} srcLang="en" label="English" default />
      </video>

      {/* Center play button when paused */}
      {!isPlaying && (
        <button
          className={styles.centerPlayBtn}
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          aria-label="Play"
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="white"><path d="M11 7l16 11-16 11V7z" /></svg>
        </button>
      )}

      {/* Control bar */}
      <div
        className={`${styles.controlBar} ${showControls ? styles.controlsVisible : styles.controlsHidden}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Seekbar */}
        <div
          className={styles.seekbar}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          tabIndex={0}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seek((e.clientX - rect.left) / rect.width);
          }}
          onKeyDown={onSeekKeyDown}
        >
          <div className={styles.seekTrack}>
            <div className={styles.seekBuffered} style={{ width: `${bufferedPct}%` }} />
            <div className={styles.seekPlayed} style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Left controls */}
        <div className={styles.controlsLeft}>
          <button className={styles.controlBtn} onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <button className={styles.controlBtn} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted || volume === 0 ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M1 9v6h4l5 5V4L5 9H1zm16.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
            ) : volume > 0.5 ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M7 9v6h4l5 5V4l-5 5H7zm9.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /></svg>
            )}
          </button>
          <span className={styles.timeDisplay}>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>

        {/* Right controls */}
        <div className={styles.controlsRight}>
          <button className={`${styles.controlBtn} ${ccOn ? styles.ccActive : ''}`} onClick={toggleCc} aria-label="Subtitles/closed captions" aria-pressed={ccOn}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" /></svg>
          </button>
          <div className={styles.settingsWrap}>
            <button className={styles.controlBtn} onClick={() => setShowSettings(s => !s)} aria-label="Settings" aria-expanded={showSettings}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>
            </button>
            {showSettings && (
              <div className={styles.settingsMenu} role="menu" onClick={(e) => e.stopPropagation()}>
                <div className={styles.settingsHeader}>Playback speed</div>
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                  <button
                    key={rate}
                    className={styles.settingsRow}
                    role="menuitemradio"
                    aria-checked={playbackRate === rate}
                    onClick={() => changeRate(rate)}
                  >
                    <span>{rate === 1 ? 'Normal' : `${rate}x`}</span>
                    {playbackRate === rate && <span className={styles.settingsCheck}>&#10003;</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={styles.controlBtn} onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}>
            {isFullscreen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
