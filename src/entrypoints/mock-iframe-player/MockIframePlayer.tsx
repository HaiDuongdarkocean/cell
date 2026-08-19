import { useEffect, useRef, useState, useCallback, useMemo, type ReactElement } from 'react';
import helloMp4 from '../design-system-showcase/assets/hello.mp4?url';
import helloSrt from '../design-system-showcase/assets/hello.srt?raw';
import jeremyChelseaMp4 from '../design-system-showcase/assets/jeremy-chelsea.mp4?url';
import jeremyChelseaSrt from '../design-system-showcase/assets/jeremy-chelsea.srt?raw';
import pleaseAcousticMp4 from '../design-system-showcase/assets/please-acoustic.mp4?url';
import pleaseAcousticSrt from '../design-system-showcase/assets/please-acoustic.srt?raw';
import fallInLoveMp4 from '../design-system-showcase/assets/fall-in-love.mp4?url';
import fallInLoveSrt from '../design-system-showcase/assets/fall-in-love.srt?raw';
import apologizeMp4 from '../design-system-showcase/assets/apologize.mp4?url';
import apologizeSrt from '../design-system-showcase/assets/apologize.srt?raw';
import { parseSrt } from '@/shared/lib/parsers/srtParser';
import type { SrtCue } from '@/entities/media';
// Reuse player styles from the same-origin mock — vite bundles the CSS module
// into this entrypoint's chunk. Avoids duplicating ~200 lines of player CSS.
import styles from '../mock-streaming-page/MockStreamingPage.module.css';
import ownStyles from './MockIframePlayer.module.css';

interface MockVideo {
  readonly id: string;
  readonly title: string;
  readonly mp4: string;
  readonly cues: readonly SrtCue[];
}

const VIDEOS: readonly MockVideo[] = [
  { id: 'jeremy-chelsea', title: 'you were good to me (Live)', mp4: jeremyChelseaMp4, cues: parseSrt(jeremyChelseaSrt).cues },
  { id: 'please-acoustic', title: 'please (Acoustic)', mp4: pleaseAcousticMp4, cues: parseSrt(pleaseAcousticSrt).cues },
  { id: 'fall-in-love', title: 'this is how you fall in love', mp4: fallInLoveMp4, cues: parseSrt(fallInLoveSrt).cues },
  { id: 'apologize', title: 'Apologize ft. OneRepublic', mp4: apologizeMp4, cues: parseSrt(apologizeSrt).cues },
  { id: 'hello', title: 'hello (demo)', mp4: helloMp4, cues: parseSrt(helloSrt).cues },
];

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

// <track> mode: VTT blob URL is created per active video in the component
// (same-origin with this iframe — 127.0.0.1:4324 — so no CORS issues).

type PlayerMode = 'hash' | 'track';

function readMode(): PlayerMode {
  const params = new URLSearchParams(window.location.search);
  const m = params.get('mode');
  return m === 'track' ? 'track' : 'hash';
}

function readVideoIndex(): number {
  const params = new URLSearchParams(window.location.search);
  const v = Number(params.get('v') ?? '0');
  return Number.isFinite(v) && v >= 0 && v < VIDEOS.length ? v : 0;
}

export function MockIframePlayer(): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subtitleLang, setSubtitleLang] = useState('English');
  const [quality, setQuality] = useState('480P');
  const [showSubDropdown, setShowSubDropdown] = useState(false);
  const [showQualDropdown, setShowQualDropdown] = useState(false);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mode = readMode();
  const activeVideo = VIDEOS[readVideoIndex()] ?? VIDEOS[0];
  const vttUrl = useMemo(
    () => URL.createObjectURL(new Blob([srtToVtt(activeVideo.cues)], { type: 'text/vtt' })),
    [activeVideo],
  );
  useEffect(() => () => URL.revokeObjectURL(vttUrl), [vttUrl]);

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

  // hash mode: no <track> — subtitle list is encoded in this iframe's src hash
  // (parsed by the extension's iframeHash adapter). track mode: native <track>.
  const activeCue = mode === 'track'
    ? activeVideo.cues.find(c => c.start <= currentTime * 1000 && c.end >= currentTime * 1000)
    : undefined;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={ownStyles.playerRoot}>
      <div
        className={`player-container art-video-player ${isPlaying ? 'art-playing' : 'art-paused'} ${showControls ? 'art-control-show' : ''} ${isBuffering ? 'art-loading-show' : ''}`}
        id="player-wrapper"
        onMouseMove={showControlsTemporarily}
        onMouseLeave={() => isPlaying && setShowControls(false)}
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
            {mode === 'track' && (
              <track
                kind="subtitles"
                src={vttUrl}
                srcLang="en"
                label="English"
                default
              />
            )}
          </video>
        </div>

        {isBuffering && (
          <div className="art-loading">
            <div className={styles.spinner} />
          </div>
        )}

        {!isPlaying && !isBuffering && (
          <div className="art-mask" onClick={handlePlayPause}>
            <div className="art-state">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {activeCue && isPlaying && (
          <div className={styles.subtitleOverlay}>
            {activeCue.text}
          </div>
        )}

        {showControls && (
          <div className="art-controls">
            <div className="art-control art-control-progress" onClick={handleProgressClick}>
              <div className={styles.progressTrack}>
                <div className={styles.progressBuffered} style={{ width: `${Math.min(progressPct + 5, 100)}%` }} />
                <div className={styles.progressPlayed} style={{ width: `${progressPct}%` }}>
                  <div className={styles.progressThumb} />
                </div>
              </div>
            </div>

            <div className={styles.controlsBar}>
              <button type="button" className={styles.artControlBtn} onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>

              <button type="button" className={styles.artControlBtn} onClick={toggleMute} aria-label="Volume">
                {isMuted || volume === 0 ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                )}
              </button>
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

              <div className={styles.timeDisplay}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>

              <div className={styles.controlsRight}>
                <div className={styles.dropdownWrap}>
                  <button
                    type="button"
                    className={styles.artControlBtn}
                    onClick={() => { setShowSubDropdown(v => !v); setShowQualDropdown(false); }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z" /></svg>
                    <span className={styles.controlLabel}>{subtitleLang}</span>
                  </button>
                  {showSubDropdown && (
                    <div className={styles.dropdown}>
                      {['Off', 'English', 'Vietnamese', 'DualSub'].map(lang => (
                        <button
                          key={lang}
                          type="button"
                          className={`${styles.dropdownItem} ${subtitleLang === lang ? styles.dropdownItemActive : ''}`}
                          onClick={() => { setSubtitleLang(lang); setShowSubDropdown(false); }}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.dropdownWrap}>
                  <button
                    type="button"
                    className={styles.artControlBtn}
                    onClick={() => { setShowQualDropdown(v => !v); setShowSubDropdown(false); }}
                  >
                    <span className={styles.qualityBadge}>{quality}</span>
                  </button>
                  {showQualDropdown && (
                    <div className={styles.dropdown}>
                      {['480P', '720P', '1080P', 'Auto'].map(q => (
                        <button
                          key={q}
                          type="button"
                          className={`${styles.dropdownItem} ${quality === q ? styles.dropdownItemActive : ''}`}
                          onClick={() => { setQuality(q); setShowQualDropdown(false); }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button type="button" className={styles.artControlBtn} aria-label="Settings">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>
                </button>

                <button type="button" className={styles.artControlBtn} aria-label="Picture in picture">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z" /></svg>
                </button>

                <button type="button" className={styles.artControlBtn} onClick={toggleFullscreen} aria-label="Fullscreen">
                  {isFullscreen ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mode badge — visible to confirm which subtitle discovery path this
          iframe exercises. Helps when debugging the extension in DevTools. */}
      <div className={ownStyles.modeBadge} data-mode={mode}>
        iframe player · mode={mode}
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
