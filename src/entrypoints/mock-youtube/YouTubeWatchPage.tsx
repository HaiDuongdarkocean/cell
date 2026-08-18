import { useEffect, useRef, useState, useCallback, type ReactElement } from 'react';
import helloMp4 from '../design-system-showcase/assets/hello.mp4?url';
import helloSrt from '../design-system-showcase/assets/hello.srt?raw';
import { parseSrt } from '@/shared/lib/parsers/srtParser';
import type { SrtCue } from '@/entities/media';
import styles from './YouTubeWatchPage.module.css';

const CUES: SrtCue[] = parseSrt(helloSrt).cues;

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

const VTT_BLOB = new Blob([srtToVtt(CUES)], { type: 'text/vtt' });
const VTT_URL = URL.createObjectURL(VTT_BLOB);

// === YouTube mock data ===
const GUIDE_ITEMS = [
  { icon: '🏠', label: 'Home', href: '/', active: false },
  { icon: '⚡', label: 'Shorts', href: '/shorts', active: false },
  { icon: '📺', label: 'Subscriptions', href: '/feed/subscriptions', active: false },
  { icon: '👤', label: 'You', href: '/feed/you', active: true },
  { icon: '🕐', label: 'History', href: '/feed/history', active: false },
  { icon: '▶️', label: 'Your videos', href: '/feed/my_videos', active: false },
  { icon: '⏰', label: 'Watch later', href: '/playlist?list=WL', active: false },
  { icon: '👍', label: 'Liked videos', href: '/playlist?list=LL', active: false },
];

const SUBSCRIPTIONS = [
  { name: 'Adele', color: '#ff0000', live: false },
  { name: 'MrBeast', color: '#0066ff', live: false },
  { name: 'Linus Tech Tips', color: '#ff6600', live: true },
  { name: 'Marques Brownlee', color: '#000', live: false },
  { name: 'Veritasium', color: '#333', live: false },
];

const RELATED_VIDEOS = [
  { title: 'Adele - Set Fire to the Rain (Official Music Video)', channel: 'Adele', views: '1.8B views', age: '12 years ago', duration: '4:16', thumb: 'linear-gradient(135deg, #ff6b6b, #ee5a6f)' },
  { title: 'Adele - Someone Like You (Official Music Video)', channel: 'Adele', views: '3.5B views', age: '14 years ago', duration: '4:45', thumb: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { title: 'Adele - Rolling in the Deep (Official Music Video)', channel: 'Adele', views: '2.8B views', age: '14 years ago', duration: '3:48', thumb: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { title: 'Adele - Easy On Me (Official Video)', channel: 'Adele', views: '1.2B views', age: '4 years ago', duration: '3:44', thumb: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { title: 'Adele - When We Were Young (Live at The BRITs)', channel: 'Adele', views: '850M views', age: '9 years ago', duration: '5:43', thumb: 'linear-gradient(135deg, #43e97b, #38f9d7)' },
  { title: 'Sam Smith - Stay With Me (Official Video)', channel: 'Sam Smith', views: '1.9B views', age: '11 years ago', duration: '2:52', thumb: 'linear-gradient(135deg, #fa709a, #fee140)' },
  { title: 'Ed Sheeran - Perfect (Official Music Video)', channel: 'Ed Sheeran', views: '3.6B views', age: '8 years ago', duration: '4:23', thumb: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' },
  { title: 'John Legend - All of Me (Official Video)', channel: 'John Legend', views: '2.9B views', age: '11 years ago', duration: '4:29', thumb: 'linear-gradient(135deg, #f6d365, #fda085)' },
];

const PLAYLIST_ITEMS = [
  { title: 'Adele - Hello', channel: 'Adele', duration: '6:07', active: true },
  { title: 'Adele - Set Fire to the Rain', channel: 'Adele', duration: '4:16', active: false },
  { title: 'Adele - Someone Like You', channel: 'Adele', duration: '4:45', active: false },
  { title: 'Adele - Rolling in the Deep', channel: 'Adele', duration: '3:48', active: false },
  { title: 'Adele - Easy On Me', channel: 'Adele', duration: '3:44', active: false },
  { title: 'Adele - When We Were Young', channel: 'Adele', duration: '5:43', active: false },
];

const COMMENTS = [
  { author: 'Sarah Johnson', avatar: '#ff6b6b', time: '5 years ago', text: 'This song never gets old. Adele\'s voice is absolutely timeless. 💕', likes: '394', replies: 22 },
  { author: 'Michael Chen', avatar: '#0066ff', time: '3 years ago', text: 'I still remember the first time I heard this. Gave me chills then, still gives me chills now.', likes: '1.2K', replies: 5 },
  { author: 'Emma Williams', avatar: '#43e97b', time: '1 year ago', text: '2026 and still listening. This is what real music sounds like.', likes: '8.5K', replies: 47 },
  { author: 'David Rodriguez', avatar: '#fa709a', time: '8 months ago', text: 'The production quality of this video is insane even by today\'s standards.', likes: '567', replies: 12 },
  { author: 'Lisa Anderson', avatar: '#a18cd1', time: '2 months ago', text: 'Her vocals are from another world. No autotune needed, just pure talent.', likes: '2.3K', replies: 8 },
];

export function YouTubeWatchPage(): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [ccOn, setCcOn] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimeUpdate = useCallback(() => setCurrentTime(videoRef.current?.currentTime ?? 0), []);
  const handleLoadedMetadata = useCallback(() => { setDuration(videoRef.current?.duration ?? 0); setIsBuffering(false); }, []);
  const handleWaiting = useCallback(() => setIsBuffering(true), []);
  const handlePlaying = useCallback(() => setIsBuffering(false), []);
  const handleCanPlay = useCallback(() => setIsBuffering(false), []);

  const handlePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
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
    v.volume = vol; v.muted = vol === 0;
    setVolume(vol); setIsMuted(vol === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted; setIsMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const wrap = videoRef.current?.parentElement?.parentElement;
    if (!wrap) return;
    if (!document.fullscreenElement) { void wrap.requestFullscreen(); setIsFullscreen(true); }
    else { void document.exitFullscreen(); setIsFullscreen(false); }
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isPlaying) controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) setShowControls(true);
    showControlsTemporarily();
  }, [isPlaying, showControlsTemporarily]);

  const activeCue = CUES.find(c => c.start <= currentTime * 1000 && c.end >= currentTime * 1000);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.page}>
      {/* === Masthead (top bar) === */}
      <header className={styles.masthead}>
        <div className={styles.mastheadLeft}>
          <button type="button" className={styles.menuBtn} onClick={() => setShowSidebar(s => !s)} aria-label="Guide">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" /></svg>
          </button>
          <a href="/" className={styles.ytLogo} aria-label="YouTube Home">
            <svg width="90" height="20" viewBox="0 0 90 20" fill="none">
              <rect x="0" y="0" width="28" height="20" rx="6" fill="#FF0000" />
              <path d="M11 5l7 5-7 5V5z" fill="white" />
              <text x="32" y="16" fontFamily="Roboto, sans-serif" fontSize="18" fontWeight="500" fill="white">YouTube</text>
            </svg>
          </a>
        </div>
        <div className={styles.mastheadCenter}>
          <div className={styles.searchContainer}>
            <input type="text" className={styles.searchInput} placeholder="Search" aria-label="Search" />
            <button type="button" className={styles.searchBtn} aria-label="Search">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
            </button>
          </div>
          <button type="button" className={styles.voiceBtn} aria-label="Search with your voice">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
          </button>
        </div>
        <div className={styles.mastheadRight}>
          <button type="button" className={styles.iconBtn} aria-label="Create">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M14 13v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm5.5-7.5h-15v15h15v-15zm-16-1h17v17h-17v-17z" /></svg>
          </button>
          <button type="button" className={styles.iconBtn} aria-label="Notifications">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>
          </button>
          <button type="button" className={styles.signInBtn}>Sign in</button>
        </div>
      </header>

      {/* === Layout: sidebar + content === */}
      <div className={styles.layout}>
        {/* === Left Sidebar (guide) === */}
        {showSidebar && (
          <aside className={styles.guide}>
            <nav className={styles.guideNav}>
              {GUIDE_ITEMS.map((item) => (
                <a key={item.label} href={item.href} className={`${styles.guideItem} ${item.active ? styles.guideItemActive : ''}`}>
                  <span className={styles.guideIcon}>{item.icon}</span>
                  <span className={styles.guideLabel}>{item.label}</span>
                </a>
              ))}
            </nav>
            <div className={styles.guideDivider} />
            <div className={styles.guideSectionTitle}>Subscriptions</div>
            {SUBSCRIPTIONS.map((sub) => (
              <a key={sub.name} href="#" className={styles.guideItem}>
                <span className={styles.guideAvatar} style={{ background: sub.color }}>
                  {sub.name[0]}
                  {sub.live && <span className={styles.liveDot} />}
                </span>
                <span className={styles.guideLabel}>{sub.name}</span>
              </a>
            ))}
            <div className={styles.guideDivider} />
            <div className={styles.guideFooter}>
              <span>About</span><span>Press</span><span>Copyright</span>
              <span>Contact us</span><span>Creators</span><span>Advertise</span>
              <span>Developers</span><span>Terms</span><span>Privacy</span>
              <span>Policy & Safety</span><span>How YouTube works</span>
              <span>Test new features</span>
              <p>© 2026 Google LLC</p>
            </div>
          </aside>
        )}

        {/* === Main Content === */}
        <main className={styles.main}>
          <div className={styles.mainGrid}>
            {/* === Primary Column === */}
            <div className={styles.primary}>
              {/* === Video Player === */}
              <div
                className={`html5-video-player ${isPlaying ? 'playing-mode' : 'unstarted-mode'} ${isBuffering ? 'buffering-mode' : ''} ${showControls ? 'ytp-show-controls' : ''}`}
                id="movie_player"
                onMouseMove={showControlsTemporarily}
                onMouseLeave={() => isPlaying && setShowControls(false)}
              >
                <div className={styles.videoWrap}>
                  <video
                    ref={videoRef}
                    className="video-stream html5-main-video"
                    src={helloMp4}
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
                    <track kind="subtitles" src={VTT_URL} srcLang="en" label="English" default />
                  </video>
                </div>

                {/* Gradient overlays */}
                <div className={`ytp-gradient-top ${styles.gradientTop}`} />
                <div className={`ytp-gradient-bottom ${styles.gradientBottom}`} />

                {/* Loading spinner */}
                {isBuffering && (
                  <div className="ytp-spinner">
                    <div className={styles.spinner}>
                      <div className={styles.spinnerCircle} />
                    </div>
                  </div>
                )}

                {/* Big play button (unstarted) */}
                {!isPlaying && !isBuffering && (
                  <button type="button" className="ytp-large-play-button" onClick={handlePlayPause} aria-label="Play">
                    <svg width="68" height="48" viewBox="0 0 68 48" fill="white">
                      <path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.32-6.18C56.54.5 34 .5 34 .5S11.46.5 6.8 1.56c-2.83.77-4.54 3.25-5.32 6.18C.4 12.39.4 24 .4 24s0 11.61 1.08 16.26c.78 2.93 2.49 5.41 5.32 6.18C11.46 47.5 34 47.5 34 47.5s22.54 0 27.2-1.06c2.83-.77 4.54-3.25 5.32-6.18C67.6 35.61 67.6 24 67.6 24s0-11.61-1.08-16.26z" fill="#212121" />
                      <path d="M26 15l14 9-14 9V15z" fill="white" />
                      <path d="M26 15l14 9-14 9V15z" fill="white" className={styles.playIconFill} />
                    </svg>
                  </button>
                )}

                {/* Subtitle overlay */}
                {activeCue && isPlaying && ccOn && (
                  <div className={styles.subtitleOverlay}>{activeCue.text}</div>
                )}

                {/* Controls (ytp-chrome-bottom) */}
                {showControls && (
                  <div className="ytp-chrome-bottom">
                    {/* Progress bar */}
                    <div className="ytp-progress-bar" onClick={handleProgressClick}>
                      <div className={styles.ytpProgressTrack}>
                        <div className={styles.ytpProgressBuffered} style={{ width: `${Math.min(progressPct + 8, 100)}%` }} />
                        <div className={styles.ytpProgressPlayed} style={{ width: `${progressPct}%` }}>
                          <div className={styles.ytpProgressThumb} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.ytpControlsRow}>
                      {/* Play/Pause */}
                      <button type="button" className={styles.ytpBtn} onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
                        {isPlaying ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                        )}
                      </button>
                      {/* Next */}
                      <button type="button" className={styles.ytpBtn} aria-label="Next">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                      </button>
                      {/* Volume */}
                      <button type="button" className={styles.ytpBtn} onClick={toggleMute} aria-label="Mute">
                        {isMuted || volume === 0 ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                        )}
                      </button>
                      <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className={styles.ytpVolumeSlider} aria-label="Volume" />
                      {/* Time */}
                      <span className={styles.ytpTimeDisplay}>
                        <span className={styles.ytpTimeCurrent}>{formatTime(currentTime)}</span>
                        {' / '}
                        <span className={styles.ytpTimeDuration}>{formatTime(duration)}</span>
                      </span>
                      {/* Right controls */}
                      <div className={styles.ytpControlsRight}>
                        {/* CC */}
                        <button type="button" className={`${styles.ytpBtn} ${ccOn ? styles.ytpBtnActive : ''}`} onClick={() => setCcOn(v => !v)} aria-label="Subtitles/CC">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z" /></svg>
                        </button>
                        {/* Settings */}
                        <button type="button" className={styles.ytpBtn} aria-label="Settings">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>
                        </button>
                        {/* Miniplayer */}
                        <button type="button" className={styles.ytpBtn} aria-label="Miniplayer">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z" /></svg>
                        </button>
                        {/* Theater */}
                        <button type="button" className={styles.ytpBtn} aria-label="Theater mode">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 6.5H5c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7c0-1.1-.9-2-2-2zm0 9H5v-7h14v7z" /></svg>
                        </button>
                        {/* Fullscreen */}
                        <button type="button" className={styles.ytpBtn} onClick={toggleFullscreen} aria-label="Fullscreen">
                          {isFullscreen ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" /></svg>
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* === Video Info === */}
              <div className={styles.videoInfo}>
                <h1 className={styles.videoTitle}>Adele - Hello (Official Music Video)</h1>
                <div className={styles.infoRow}>
                  <div className={styles.channelInfo}>
                    <div className={styles.channelAvatar} style={{ background: '#ff0000' }}>A</div>
                    <div className={styles.channelMeta}>
                      <div className={styles.channelName}>Adele</div>
                      <div className={styles.subCount}>33.4M subscribers</div>
                    </div>
                    <button type="button" className={styles.subscribeBtn}>Subscribe</button>
                  </div>
                  <div className={styles.actionButtons}>
                    <div className={styles.likeDislikeGroup}>
                      <button type="button" className={styles.likeBtn}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
                        <span>3.2M</span>
                      </button>
                      <div className={styles.likeDislikeDivider} />
                      <button type="button" className={styles.dislikeBtn}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" /></svg>
                      </button>
                    </div>
                    <button type="button" className={styles.actionBtn}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" /></svg>
                      <span>Share</span>
                    </button>
                    <button type="button" className={styles.actionBtn}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" /></svg>
                      <span>Download</span>
                    </button>
                    <button type="button" className={styles.actionBtn}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" /></svg>
                      <span>Clip</span>
                    </button>
                    <button type="button" className={styles.actionBtn}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17 18.55c-1.41 0-2.55 1.14-2.55 2.55S15.59 23.65 17 23.65s2.55-1.14 2.55-2.55S18.41 18.55 17 18.55zM1 3.45v2.1h2.1l3.78 7.97-1.41 2.46c-.17.31-.27.66-.27 1.05 0 1.41 1.14 2.55 2.55 2.55h12.6v-2.1H7.22c-.17 0-.31-.14-.31-.31l.03-.07 1.41-2.48h7.45c.95 0 1.78-.52 2.21-1.31l3.78-6.86c.08-.15.12-.31.12-.48 0-.58-.47-1.05-1.05-1.05H4.43L3.02 1.45H1zm6.3 15.1c-1.41 0-2.55 1.14-2.55 2.55s1.14 2.55 2.55 2.55 2.55-1.14 2.55-2.55-1.14-2.55-2.55-2.55z" /></svg>
                      <span>Save</span>
                    </button>
                    <button type="button" className={styles.actionBtnIcon} aria-label="More">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* === Description Box === */}
              <div className={styles.descriptionBox} onClick={() => setDescExpanded(v => !v)}>
                <div className={styles.descMeta}>
                  3,273,764,024 views • Oct 23, 2015
                </div>
                <div className={styles.descContent}>
                  Listen to "Easy On Me" here: http://Adele.lnk.to/EOM<br />
                  Pre-order Adele's new album "30" before its release on November 19: https://www.adele.com<br />
                  Shop the "Adele" collection here: http://shop.adele.com<br /><br />
                  {descExpanded && (
                    <>
                      Follow Adele:<br />
                      Instagram: https://www.instagram.com/adele<br />
                      Twitter: https://twitter.com/adele<br />
                      Facebook: https://www.facebook.com/adele<br /><br />
                      Lyrics:<br />
                      Hello, it's me<br />
                      I was wondering if after all these years you'd like to meet<br />
                      To go over everything<br />
                      They say that time's supposed to heal ya<br />
                      But I ain't done much healing<br /><br />
                      Hello, can you hear me?<br />
                      I'm in California dreaming about who we used to be<br />
                      When we were younger and free<br />
                      I've forgotten how it felt before the world fell at our feet<br /><br />
                      #Adele #Hello #OfficialMusicVideo
                    </>
                  )}
                  {!descExpanded && <span className={styles.descMore}>…more</span>}
                </div>
              </div>

              {/* === Comments === */}
              <div className={styles.commentsSection}>
                <div className={styles.commentsHeader}>
                  <span className={styles.commentsCount}>1.2M Comments</span>
                  <button type="button" className={styles.sortBtn}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm6 7h12v-2H9v2z" /></svg>
                    Sort by
                  </button>
                </div>
                <div className={styles.commentInput}>
                  <div className={styles.commentAvatar} style={{ background: '#666' }}>Y</div>
                  <input type="text" placeholder="Add a comment..." className={styles.commentInputField} />
                </div>
                <div className={styles.commentList}>
                  {COMMENTS.map((c, i) => (
                    <div key={i} className={styles.commentThread}>
                      <div className={styles.commentAvatar} style={{ background: c.avatar }}>{c.author[0]}</div>
                      <div className={styles.commentBody}>
                        <div className={styles.commentMeta}>
                          <span className={styles.commentAuthor}>{c.author}</span>
                          <span className={styles.commentTime}>{c.time}</span>
                        </div>
                        <p className={styles.commentText}>{c.text}</p>
                        <div className={styles.commentActions}>
                          <button type="button" className={styles.commentLikeBtn}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>
                            {c.likes}
                          </button>
                          <button type="button" className={styles.commentLikeBtn}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" /></svg>
                          </button>
                          <button type="button" className={styles.commentReplyBtn}>Reply</button>
                        </div>
                        {c.replies > 0 && (
                          <button type="button" className={styles.commentRepliesBtn}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M7 10l5 5 5-5z" /></svg>
                            {c.replies} replies
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* === Secondary Column === */}
            <div className={styles.secondary}>
              {/* Playlist panel */}
              <div className={styles.playlistPanel}>
                <div className={styles.playlistHeader}>
                  <div className={styles.playlistHeaderTop}>
                    <span className={styles.playlistTitle}>Adele - Greatest Hits</span>
                    <div className={styles.playlistMeta}>
                      <span>Adele - Topic</span>
                      <span className={styles.playlistIndex}>1 / 6</span>
                    </div>
                  </div>
                  <div className={styles.playlistControls}>
                    <button type="button" aria-label="Previous"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg></button>
                    <button type="button" aria-label="Play/Pause"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg></button>
                    <button type="button" aria-label="Next"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg></button>
                  </div>
                </div>
                <div className={styles.playlistItems}>
                  {PLAYLIST_ITEMS.map((item, i) => (
                    <div key={i} className={`${styles.playlistItem} ${item.active ? styles.playlistItemActive : ''}`}>
                      <span className={styles.playlistItemIndex}>{item.active ? '▶' : i + 1}</span>
                      <div className={styles.playlistItemThumb} style={{ background: `hsl(${i * 60}, 60%, 50%)` }} />
                      <div className={styles.playlistItemMeta}>
                        <div className={styles.playlistItemTitle}>{item.title}</div>
                        <div className={styles.playlistItemChannel}>{item.channel}</div>
                      </div>
                      <span className={styles.playlistItemDuration}>{item.duration}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related videos */}
              <div className={styles.relatedSection}>
                {RELATED_VIDEOS.map((v, i) => (
                  <div key={i} className={styles.relatedItem}>
                    <div className={styles.relatedThumb} style={{ background: v.thumb }}>
                      <span className={styles.relatedDuration}>{v.duration}</span>
                    </div>
                    <div className={styles.relatedMeta}>
                      <div className={styles.relatedTitle}>{v.title}</div>
                      <div className={styles.relatedChannel}>{v.channel}</div>
                      <div className={styles.relatedViews}>{v.views} • {v.age}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
