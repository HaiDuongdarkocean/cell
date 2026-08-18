import { useEffect, useRef, useState, useCallback, type ReactElement } from 'react';
import helloMp4 from '../design-system-showcase/assets/hello.mp4?url';
import helloSrt from '../design-system-showcase/assets/hello.srt?raw';
import { parseSrt } from '@/shared/lib/parsers/srtParser';
import type { SrtCue } from '@/entities/media';
import styles from './MockStreamingPage.module.css';

const CUES: SrtCue[] = parseSrt(helloSrt).cues;

// Convert SRT cues → WebVTT for <track> element
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

// Create blob URL for VTT track
const VTT_BLOB = new Blob([srtToVtt(CUES)], { type: 'text/vtt' });
const VTT_URL = URL.createObjectURL(VTT_BLOB);

const EPISODES = [
  { num: 1, title: 'Episode 1', active: true },
  { num: 2, title: 'Episode 2', active: false },
  { num: 3, title: 'Episode 3', active: false },
  { num: 4, title: 'Episode 4', active: false },
  { num: 5, title: 'Episode 5', active: false },
  { num: 6, title: 'Episode 6', active: false },
  { num: 7, title: 'Episode 7', active: false },
  { num: 8, title: 'Episode 8', active: false },
  { num: 9, title: 'Episode 9', active: false },
  { num: 10, title: 'Episode 10', active: false },
  { num: 11, title: 'Episode 11', active: false },
  { num: 12, title: 'Episode 12', active: false },
];

const SERVERS = [
  { id: 'server-1', label: 'Server 1', quality: 'HD', active: true },
  { id: 'server-2', label: 'Server 2', quality: 'HD', active: false },
  { id: 'server-3', label: 'Server 3', quality: 'Full HD', active: false },
  { id: 'server-4', label: 'Server 4', quality: 'Full HD', active: false },
];

const RECOMMENDED = [
  { title: 'Solo Leveling Season 2', img: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { title: 'Tower of God', img: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { title: 'The Beginning After The End', img: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
  { title: 'Omniscient Reader', img: 'linear-gradient(135deg, #43e97b, #38f9d7)' },
  { title: 'Legend of the Northern Blade', img: 'linear-gradient(135deg, #fa709a, #fee140)' },
  { title: 'Return of the Mount Hua Sect', img: 'linear-gradient(135deg, #a18cd1, #fbc2eb)' },
];

const COMMENTS = [
  { user: 'AnimeFan2024', time: '2 hours ago', text: 'Jin Woo is the GOAT! This episode gave me chills.', likes: 42 },
  { user: 'ShadowMonarch', time: '5 hours ago', text: 'The animation quality is insane. A-1 Pictures cooked.', likes: 28 },
  { user: 'LevelUpKing', time: '1 day ago', text: 'Best anime of 2024 no cap. The system mechanics are so cool.', likes: 15 },
];

export function MockStreamingPage(): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeServer, setActiveServer] = useState('server-1');
  const [activeEp, setActiveEp] = useState(1);
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

  const handleSeek = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
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

  // Auto-hide controls after 3s of inactivity when playing
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

  // Active cue for subtitle display
  const activeCue = CUES.find(c => c.start <= currentTime * 1000 && c.end >= currentTime * 1000);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.page}>
      {/* === Header === */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="#" className={styles.logo}>
            <span className={styles.logoIcon}>▶</span>
            StreamFlix
          </a>
          <nav className={styles.nav}>
            <a href="#">Home</a>
            <a href="#">Movies</a>
            <a href="#">TV Series</a>
            <a href="#">Anime</a>
            <a href="#">Top IMDb</a>
          </nav>
          <div className={styles.headerRight}>
            <button type="button" className={styles.searchBtn} aria-label="Search">🔍</button>
            <button type="button" className={styles.loginBtn}>Login</button>
          </div>
        </div>
      </header>

      {/* === Breadcrumb === */}
      <div className={styles.breadcrumb}>
        <a href="#">Home</a>
        <span>›</span>
        <a href="#">Anime</a>
        <span>›</span>
        <a href="#">Solo Leveling</a>
        <span>›</span>
        <span className={styles.breadcrumbActive}>Episode 1</span>
      </div>

      {/* === Main Content === */}
      <main className={styles.main}>
        <div className={styles.mainGrid}>
          {/* === Video Player Section === */}
          <div className={styles.playerSection}>
            {/* Player container — class/ID pattern matching real streaming sites.
                ArtPlayer-style: .art-video-player with .art-mask, .art-loading, .art-controls */}
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
                  <track
                    kind="subtitles"
                    src={VTT_URL}
                    srcLang="en"
                    label="English"
                    default
                  />
                </video>
              </div>

              {/* Loading spinner — .art-loading */}
              {isBuffering && (
                <div className="art-loading">
                  <div className={styles.spinner} />
                </div>
              )}

              {/* Mask/state overlay — big play button when paused */}
              {!isPlaying && !isBuffering && (
                <div className="art-mask" onClick={handlePlayPause}>
                  <div className="art-state">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Subtitle display overlay */}
              {activeCue && isPlaying && (
                <div className={styles.subtitleOverlay}>
                  {activeCue.text}
                </div>
              )}

              {/* Controls bar — .art-controls */}
              {showControls && (
                <div className="art-controls">
                  {/* Progress bar */}
                  <div className="art-control art-control-progress" onClick={handleProgressClick}>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressBuffered} style={{ width: `${Math.min(progressPct + 5, 100)}%` }} />
                      <div className={styles.progressPlayed} style={{ width: `${progressPct}%` }}>
                        <div className={styles.progressThumb} />
                      </div>
                    </div>
                  </div>

                  <div className={styles.controlsBar}>
                    {/* Play/Pause */}
                    <button type="button" className={styles.artControlBtn} onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
                      {isPlaying ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                      )}
                    </button>

                    {/* Volume */}
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

                    {/* Time */}
                    <div className={styles.timeDisplay}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>

                    {/* Right controls */}
                    <div className={styles.controlsRight}>
                      {/* Subtitle selector */}
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

                      {/* Quality selector */}
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

                      {/* Settings */}
                      <button type="button" className={styles.artControlBtn} aria-label="Settings">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>
                      </button>

                      {/* PiP */}
                      <button type="button" className={styles.artControlBtn} aria-label="Picture in picture">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z" /></svg>
                      </button>

                      {/* Fullscreen */}
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

            {/* Server selector */}
            <div className={styles.serverSection}>
              <div className={styles.serverLabel}>
                <span>If the current server is not working, try switching to other servers.</span>
              </div>
              <div className={styles.serverList}>
                <span className={styles.serverType}>Soft Sub</span>
                {SERVERS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`${styles.serverBtn} ${activeServer === s.id ? styles.serverBtnActive : ''}`}
                    onClick={() => setActiveServer(s.id)}
                  >
                    {s.label}
                    <span className={styles.serverQuality}>{s.quality}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title + metadata */}
            <div className={styles.titleSection}>
              <h1 className={styles.title}>Solo Leveling</h1>
              <span className={styles.episodeLabel}>Episode 1</span>
            </div>

            <div className={styles.metadata}>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Genres:</span>
                <a href="#">Action</a>, <a href="#">Fantasy</a>, <a href="#">Adventure</a>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Studio:</span>
                <span>A-1 Pictures</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Status:</span>
                <span>Completed</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Episodes:</span>
                <span>12</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Duration:</span>
                <span>23min</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Released:</span>
                <span>2024</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Rating:</span>
                <span className={styles.rating}>⭐ 9.86</span>
              </div>
            </div>

            <p className={styles.description}>
              Humanity was caught at a precipice a decade ago when the first gates—portals linked with
              other dimensions that harbor monsters immune to conventional weaponry—emerged around the
              world. Alongside the appearance of the gates, various humans were transformed into hunters
              and bestowed superhuman abilities. Sung Jin-Woo is an E-rank hunter dubbed as the weakest
              hunter of all mankind. While exploring a supposedly safe dungeon, he and his party encounter
              an unusual tunnel leading to a deeper area.
            </p>

            {/* Comments section */}
            <div className={styles.commentsSection}>
              <h3 className={styles.commentsTitle}>Comments (3)</h3>
              <div className={styles.commentList}>
                {COMMENTS.map((c, i) => (
                  <div key={i} className={styles.comment}>
                    <div className={styles.commentAvatar}>{c.user[0]}</div>
                    <div className={styles.commentBody}>
                      <div className={styles.commentHeader}>
                        <span className={styles.commentUser}>{c.user}</span>
                        <span className={styles.commentTime}>{c.time}</span>
                      </div>
                      <p className={styles.commentText}>{c.text}</p>
                      <div className={styles.commentActions}>
                        <button type="button" className={styles.commentBtn}>👍 {c.likes}</button>
                        <button type="button" className={styles.commentBtn}>Reply</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* === Episode List Sidebar === */}
          <aside className={styles.sidebar}>
            <div className={styles.episodeSection}>
              <h3 className={styles.sidebarTitle}>Episodes</h3>
              <div className={styles.episodeRange}>
                <button type="button" className={styles.rangeBtn}>001-012</button>
              </div>
              <div className={styles.episodeList}>
                {EPISODES.map((ep) => (
                  <button
                    key={ep.num}
                    type="button"
                    className={`${styles.episodeItem} ${activeEp === ep.num ? styles.episodeItemActive : ''}`}
                    onClick={() => setActiveEp(ep.num)}
                  >
                    <span className={styles.episodeNum}>{ep.num}</span>
                    <span className={styles.episodeName}>{ep.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* === Recommendations === */}
        <section className={styles.recommendations}>
          <h3 className={styles.recommendationsTitle}>Recommended</h3>
          <div className={styles.recGrid}>
            {RECOMMENDED.map((r, i) => (
              <div key={i} className={styles.recCard}>
                <div className={styles.recPoster} style={{ background: r.img }} />
                <span className={styles.recTitle}>{r.title}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* === Footer === */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLeft}>
            <span className={styles.logo}>StreamFlix</span>
            <p className={styles.footerDisclaimer}>
              This site does not store any files on its server. All contents are provided by
              non-affiliated third parties.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <a href="#">Contact</a>
            <a href="#">Request</a>
            <a href="#">DMCA</a>
            <a href="#">Privacy Policy</a>
          </div>
        </div>
        <div className={styles.footerCopyright}>
          © 2026 StreamFlix. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
