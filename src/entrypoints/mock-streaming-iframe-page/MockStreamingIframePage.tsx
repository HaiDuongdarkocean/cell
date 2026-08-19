import { useState, useMemo, type ReactElement } from 'react';
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
import jeremyChelseaThumb from '../design-system-showcase/assets/jeremy-chelsea-thumb.jpg?url';
import pleaseAcousticThumb from '../design-system-showcase/assets/please-acoustic-thumb.jpg?url';
import fallInLoveThumb from '../design-system-showcase/assets/fall-in-love-thumb.jpg?url';
import apologizeThumb from '../design-system-showcase/assets/apologize-thumb.jpg?url';
import helloThumb from '../design-system-showcase/assets/hello-thumb.jpg?url';
import { parseSrt } from '@/shared/lib/parsers/srtParser';
import type { SrtCue } from '@/entities/media';
// Reuse the same-origin mock's page styles — the host layout (header,
// breadcrumb, server selector, metadata, comments, sidebar, recommendations)
// is identical; only the player area becomes an iframe.
import styles from '../mock-streaming-page/MockStreamingPage.module.css';
import ownStyles from './MockStreamingIframePage.module.css';

interface MockVideo {
  readonly id: string;
  readonly title: string;
  readonly mp4: string;
  readonly thumb: string;
  readonly cues: readonly SrtCue[];
}

const VIDEOS: readonly MockVideo[] = [
  { id: 'jeremy-chelsea', title: 'you were good to me (Live)', mp4: jeremyChelseaMp4, thumb: jeremyChelseaThumb, cues: parseSrt(jeremyChelseaSrt).cues },
  { id: 'please-acoustic', title: 'please (Acoustic)', mp4: pleaseAcousticMp4, thumb: pleaseAcousticThumb, cues: parseSrt(pleaseAcousticSrt).cues },
  { id: 'fall-in-love', title: 'this is how you fall in love', mp4: fallInLoveMp4, thumb: fallInLoveThumb, cues: parseSrt(fallInLoveSrt).cues },
  { id: 'apologize', title: 'Apologize ft. OneRepublic', mp4: apologizeMp4, thumb: apologizeThumb, cues: parseSrt(apologizeSrt).cues },
  { id: 'hello', title: 'hello (demo)', mp4: helloMp4, thumb: helloThumb, cues: parseSrt(helloSrt).cues },
];

// ponytail: PLAYER_ORIGIN is hardcoded to the child-frame server port defined
// in scripts/serve-mock-pages.mjs (4324). Ceiling: if the port changes there,
// it must change here too. Upgrade path: read from import.meta.env.VITE_PLAYER_PORT
// and pass through serve-mock-pages.mjs — not worth it for a mock test page.
const PLAYER_ORIGIN = 'http://127.0.0.1:4324';
const PLAYER_PATH = '/index.html';

const EPISODES = VIDEOS.map((v, i) => ({ num: i + 1, title: v.title, active: i === 0 }));

const SERVERS = [
  { id: 'server-1', label: 'Server 1', quality: 'HD', active: true },
  { id: 'server-2', label: 'Server 2', quality: 'HD', active: false },
  { id: 'server-3', label: 'Server 3', quality: 'Full HD', active: false },
  { id: 'server-4', label: 'Server 4', quality: 'Full HD', active: false },
];

const COMMENTS = [
  { user: 'AnimeFan2024', time: '2 hours ago', text: 'Jin Woo is the GOAT! This episode gave me chills.', likes: 42 },
  { user: 'ShadowMonarch', time: '5 hours ago', text: 'The animation quality is insane. A-1 Pictures cooked.', likes: 28 },
  { user: 'LevelUpKing', time: '1 day ago', text: 'Best anime of 2024 no cap. The system mechanics are so cool.', likes: 15 },
];

type SubMode = 'hash' | 'track';

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

// hash mode: subtitle list encoded in the iframe src hash as JSON, matching the
// real lunastream/moviesapi pattern parsed by iframeHash.ts. URLs use data:
// scheme so the extension can fetch them from any context without CORS.
function buildSubsHash(cues: readonly SrtCue[]): string {
  const vttDataUrl = `data:text/vtt;charset=utf-8,${encodeURIComponent(srtToVtt(cues))}`;
  const subs = [
    { label: 'English', url: vttDataUrl, language: 'en', default: true },
    { label: 'Vietnamese', url: vttDataUrl, language: 'vi' },
  ];
  return encodeURIComponent(JSON.stringify(subs));
}

function buildIframeSrc(mode: SubMode, videoIndex: number, cues: readonly SrtCue[]): string {
  const url = new URL(PLAYER_PATH, PLAYER_ORIGIN);
  url.searchParams.set('mode', mode);
  url.searchParams.set('v', String(videoIndex));
  if (mode === 'hash') {
    // Hash is not sent to the server — append after building the URL.
    return `${url.toString()}#subs=${buildSubsHash(cues)}`;
  }
  return url.toString();
}

export function MockStreamingIframePage(): ReactElement {
  const [activeServer, setActiveServer] = useState('server-1');
  const [activeEp, setActiveEp] = useState(1);
  const [subMode, setSubMode] = useState<SubMode>('hash');

  const activeVideo = VIDEOS[activeEp - 1] ?? VIDEOS[0];
  const iframeSrc = useMemo(
    () => buildIframeSrc(subMode, activeEp - 1, activeVideo.cues),
    [subMode, activeEp, activeVideo],
  );

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
        <span className={styles.breadcrumbActive}>Episode {activeEp}</span>
      </div>

      {/* === Main Content === */}
      <main className={styles.main}>
        <div className={styles.mainGrid}>
          {/* === Video Player Section === */}
          <div className={styles.playerSection}>
            {/* Subtitle discovery mode toggle — switches the iframe src between
                hash-encoded subs list (iframeHash adapter) and native <track>
                (textTracks detection). */}
            <div className={ownStyles.modeToggle} role="tablist" aria-label="Subtitle discovery mode">
              <button
                type="button"
                role="tab"
                aria-selected={subMode === 'hash'}
                className={`${ownStyles.modeTab} ${subMode === 'hash' ? ownStyles.modeTabActive : ''}`}
                onClick={() => setSubMode('hash')}
              >
                iframeHash (subs in src hash)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={subMode === 'track'}
                className={`${ownStyles.modeTab} ${subMode === 'track' ? ownStyles.modeTabActive : ''}`}
                onClick={() => setSubMode('track')}
              >
                &lt;track&gt; VTT (textTracks)
              </button>
            </div>

            {/* Cross-origin iframe player — matches real streaming sites that
                embed the player from a different origin (vidstream, doodstream,
                megaplay). The extension's iframePlayerModeBridge + manager
                bridge coordinate top-frame fullscreen + sheet portal across
                this boundary. */}
            <div className={`player-main ${ownStyles.iframeHost}`} id="player-wrapper">
              <iframe
                src={iframeSrc}
                title="StreamFlix player"
                className={ownStyles.playerIframe}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
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
              <h1 className={styles.title}>{activeVideo.title}</h1>
              <span className={styles.episodeLabel}>Episode {activeEp}</span>
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

        {/* === Recommendations — clickable thumbnails that switch the active video === */}
        <section className={styles.recommendations}>
          <h3 className={styles.recommendationsTitle}>Recommended</h3>
          <div className={styles.recGrid}>
            {VIDEOS.map((v, i) => (
              <button
                key={v.id}
                type="button"
                className={styles.recCard}
                onClick={() => { setActiveEp(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                aria-label={`Play ${v.title}`}
              >
                <img
                  className={styles.recPoster}
                  src={v.thumb}
                  alt={v.title}
                  loading="lazy"
                />
                <span className={styles.recTitle}>{v.title}</span>
              </button>
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
