import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactElement,
} from 'react';
import { Avatar, Badge, Breadcrumb, Button, Container, Flex, Heading, Icon, ListItem, Tabs, Text } from '@/shared/ui';
import { VideoPlayer } from './VideoPlayer';
import {
  VIDEOS,
  EPISODES,
  SERVERS,
  COMMENTS,
  METADATA,
  DESCRIPTION,
  buildIframeSrc,
} from './streamFlixData';
import styles from './StreamFlixPage.module.css';

export type StreamFlixMode = 'same' | 'iframe-host' | 'iframe-child';

export interface StreamFlixPageProps {
  /** Which player mode this entrypoint serves. */
  mode: StreamFlixMode;
}

type Theme = 'light' | 'dark';
type PlayerDisplay = 'same' | 'iframe';
type SubMode = 'hash' | 'track';

function readTheme(): Theme {
  const params = new URLSearchParams(window.location.search);
  const t = params.get('theme');
  if (t === 'light' || t === 'dark') return t;
  try {
    const stored = localStorage.getItem('streamflix-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore storage errors in sandboxed iframe
  }
  return 'dark';
}

function setThemeAttr(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem('streamflix-theme', theme);
  } catch {
    // ignore
  }
}

function updateUrlParam(key: string, value: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState({}, '', url.toString());
}

export function StreamFlixPage({ mode }: StreamFlixPageProps): ReactElement {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [activeEp, setActiveEp] = useState(1);
  const [activeServer, setActiveServer] = useState('server-1');
  const [playerDisplay, setPlayerDisplay] = useState<PlayerDisplay>(mode === 'iframe-host' ? 'iframe' : 'same');
  const [subMode, setSubMode] = useState<SubMode>('hash');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const mobileMenuBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const firstLink = mobileNavRef.current?.querySelector('a') as HTMLElement | null;
    firstLink?.focus();

    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    const handleClick = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (mobileNavRef.current?.contains(target)) return;
      if (mobileMenuBtnRef.current?.contains(target)) return;
      setMobileMenuOpen(false);
    };

    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setThemeAttr(theme);
    persistTheme(theme);
    updateUrlParam('theme', theme);
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('player');
    if (p === 'same' || p === 'iframe') {
      setPlayerDisplay(p);
    }
  }, []);

  const activeVideo = VIDEOS[activeEp - 1] ?? VIDEOS[0];
  const iframeSrc = useMemo(
    () => buildIframeSrc(activeEp - 1, activeVideo.cues, subMode),
    [activeEp, activeVideo, subMode],
  );

  const handlePlayerDisplayChange = useCallback((next: PlayerDisplay) => {
    setPlayerDisplay(next);
    updateUrlParam('player', next);
  }, []);

  const handleEpClick = useCallback((num: number) => {
    setActiveEp(num);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const breadcrumbItems = [
    { label: 'Home', id: 'home' },
    { label: 'Anime', id: 'anime' },
    { label: 'Solo Leveling', id: 'solo-leveling' },
    { label: `Episode ${activeEp}`, id: 'episode', current: true },
  ];

  if (mode === 'iframe-child') {
    return (
      <div className={styles.childRoot}>
        <VideoPlayer video={activeVideo} mode="child" className={styles.childPlayer} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Container maxWidth="xl" className={styles.headerInner}>
          <a href="#" className={styles.logo}>
            <span className={styles.logoIcon} aria-hidden="true">
              <Icon name="play" size="sm" />
            </span>
            <span className={styles.logoText}>StreamFlix</span>
          </a>

          <nav
            id="streamflix-nav"
            ref={mobileNavRef}
            className={`${styles.nav} ${mobileMenuOpen ? styles.navOpen : ''}`}
            aria-label="Main"
          >
            <a href="#" className={styles.navLink}>Home</a>
            <a href="#" className={styles.navLink}>Movies</a>
            <a href="#" className={styles.navLink}>TV Series</a>
            <a href="#" className={`${styles.navLink} ${styles.navLinkActive}`}>Anime</a>
            <a href="#" className={styles.navLink}>Top IMDb</a>
          </nav>

          <Flex gap="3" align="center" className={styles.headerRight}>
            <Button shape="circle" material="solid"
              variant="ghost"
              size="md"
              aria-label="Search"
              className={styles.iconBtn}
            >
              <Icon name="search" size="sm" />
            </Button>

            <button
              type="button"
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className={`${styles.themeIcon} ${theme === 'dark' ? styles.themeIconActive : ''}`}>
                <Icon name="moon" size="xs" />
              </span>
              <span className={`${styles.themeIcon} ${theme === 'light' ? styles.themeIconActive : ''}`}>
                <Icon name="sun" size="xs" />
              </span>
            </button>

            <Button material="solid" size="sm" variant="primary">
              Login
            </Button>

            <Button shape="circle"
              ref={mobileMenuBtnRef}
              material="solid"
              variant="ghost"
              size="md"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="streamflix-nav"
              className={styles.mobileMenuBtn}
              onClick={() => setMobileMenuOpen(v => !v)}
            >
              <Icon name="menu" size="sm" />
            </Button>
          </Flex>
        </Container>
      </header>

      <Container maxWidth="xl" className={styles.breadcrumbWrap}>
        <Breadcrumb items={breadcrumbItems} />
      </Container>

      <main className={styles.main}>
        <Container maxWidth="xl" className={styles.mainInner}>
          <div className={styles.mainGrid}>
            <div className={styles.playerSection}>
              {playerDisplay === 'same' ? (
                <VideoPlayer video={activeVideo} mode="same" />
              ) : (
                <div className={`${styles.iframeHost} player-main`} id="player-wrapper">
                  <iframe
                    src={iframeSrc}
                    title="StreamFlix player"
                    className={styles.iframe}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              <div className={styles.serverCard}>
                <Flex direction="column" gap="3">
                  <Text variant="supporting" color="secondary" as="p">
                    If the current server is not working, try switching to other servers.
                  </Text>

                  <Tabs
                    value={playerDisplay}
                    onValueChange={(v) => handlePlayerDisplayChange(v as PlayerDisplay)}
                  >
                    <Tabs.List className={styles.serverTabs}>
                      <Tabs.Trigger value="same" className={styles.serverTab}>
                        <Icon name="video" size="xs" />
                        Same-origin
                      </Tabs.Trigger>
                      <Tabs.Trigger value="iframe" className={styles.serverTab}>
                        <Icon name="externalLink" size="xs" />
                        Cross-origin iframe
                      </Tabs.Trigger>
                    </Tabs.List>
                  </Tabs>

                  {playerDisplay === 'iframe' && (
                    <Flex gap="2" align="center" className={styles.subModeRow}>
                      <Text variant="label" color="secondary" as="span">Subtitle mode:</Text>
                      <Tabs value={subMode} onValueChange={(v) => setSubMode(v as SubMode)}>
                        <Tabs.List className={styles.subModeTabs}>
                          <Tabs.Trigger value="hash" className={styles.subModeTab}>Hash</Tabs.Trigger>
                          <Tabs.Trigger value="track" className={styles.subModeTab}>&lt;track&gt;</Tabs.Trigger>
                        </Tabs.List>
                      </Tabs>
                    </Flex>
                  )}

                  <Flex gap="2" wrap="wrap" className={styles.serverList}>
                    <Text variant="label" color="secondary" as="span" className={styles.serverType}>Soft Sub</Text>
                    {SERVERS.map((s) => (
                      <Button material="solid"
                        key={s.id}
                        size="sm"
                        variant={activeServer === s.id ? 'primary' : 'secondary'}
                        active={activeServer === s.id}
                        onClick={() => setActiveServer(s.id)}
                      >
                        {s.label}
                        <Badge variant={activeServer === s.id ? 'default' : 'secondary'} size="xs">{s.quality}</Badge>
                      </Button>
                    ))}
                  </Flex>
                </Flex>
              </div>

              <Flex align="center" gap="3" className={styles.titleSection}>
                <Heading level={1} size={3} className={styles.title}>
                  {activeVideo.title}
                </Heading>
                <Badge variant="outline" size="sm">Episode {activeEp}</Badge>
              </Flex>

              <div className={styles.metadataCard}>
                <div className={styles.metadataGrid}>
                  {METADATA.map((m) => (
                    <div key={m.label} className={styles.metaRow}>
                      <Text variant="label" color="secondary" as="span">{m.label}:</Text>
                      {' '}
                      {m.href ? (
                        <span className={styles.metaLinks}>
                          {m.value.split(', ').map((g, i, arr) => (
                            <span key={g}>
                              <a href="#" className={styles.metaLink}>{g}</a>
                              {i < arr.length - 1 && ', '}
                            </span>
                          ))}
                        </span>
                      ) : m.rating ? (
                        <span className={styles.rating}>
                          <Icon name="star" size="sm" className={styles.ratingStar} />
                          <span className={styles.ratingValue}>{m.value}</span>
                        </span>
                      ) : (
                        <Text as="span" color="primary">{m.value}</Text>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Text variant="body" color="secondary" as="p" className={styles.description}>
                {DESCRIPTION}
              </Text>

              <div className={styles.commentsCard}>
                <Heading level={3} size={5} className={styles.commentsTitle}>
                  Comments ({COMMENTS.length})
                </Heading>
                <div className={styles.commentList}>
                  {COMMENTS.map((c, i) => (
                    <div key={i} className={styles.comment}>
                      <Avatar alt={c.user} size="sm" className={styles.commentAvatar} />
                      <div className={styles.commentBody}>
                        <Flex gap="2" align="baseline" className={styles.commentHeader}>
                          <Text variant="label" color="primary" as="span">{c.user}</Text>
                          <Text variant="supporting" color="secondary" as="span">{c.time}</Text>
                        </Flex>
                        <Text variant="body" color="primary" as="p" className={styles.commentText}>
                          {c.text}
                        </Text>
                        <Flex gap="3" className={styles.commentActions}>
                          <Button material="solid" size="sm" variant="ghost" leadingIcon={<Icon name="check" size="xs" />}>
                            {c.likes}
                          </Button>
                          <Button material="solid" size="sm" variant="ghost">
                            Reply
                          </Button>
                        </Flex>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className={styles.sidebar}>
              <div className={styles.sidebarCard}>
                <Heading level={3} size={5} className={styles.sidebarTitle}>
                  Episodes
                </Heading>
                <Button material="solid" size="sm" variant="outline" fullWidth className={styles.rangeBtn}>
                  001–012
                </Button>
                <div className={styles.episodeList}>
                  {EPISODES.map((ep) => (
                    <ListItem
                      key={ep.num}
                      active={activeEp === ep.num}
                      onClick={() => handleEpClick(ep.num)}
                      className={styles.episodeItem}
                      leading={
                        <span className={styles.episodeNum}>{ep.num}</span>
                      }
                    >
                      <Text variant="body" color={activeEp === ep.num ? 'primary' : 'secondary'} as="span" truncate>
                        {ep.title}
                      </Text>
                    </ListItem>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          <section className={styles.recommendations}>
            <Heading level={2} size={4} className={styles.recommendationsTitle}>
              Recommended
            </Heading>
            <div className={styles.recGrid}>
              {VIDEOS.map((v, i) => (
                <button
                  key={v.id}
                  type="button"
                  className={styles.recCard}
                  onClick={() => handleEpClick(i + 1)}
                  aria-label={`Play ${v.title}`}
                >
                  <img
                    className={styles.recPoster}
                    src={v.thumb}
                    alt={v.title}
                    loading="lazy"
                  />
                  <Text variant="label" color="secondary" as="span" className={styles.recTitle}>
                    {v.title}
                  </Text>
                </button>
              ))}
            </div>
          </section>
        </Container>
      </main>

      <footer className={styles.footer}>
        <Container maxWidth="xl" className={styles.footerInner}>
          <div className={styles.footerLeft}>
            <span className={styles.logoText}>StreamFlix</span>
            <Text variant="supporting" color="secondary" as="p" className={styles.footerDisclaimer}>
              This site does not store any files on its server. All contents are provided by non-affiliated third parties.
            </Text>
          </div>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>Contact</a>
            <a href="#" className={styles.footerLink}>Request</a>
            <a href="#" className={styles.footerLink}>DMCA</a>
            <a href="#" className={styles.footerLink}>Privacy Policy</a>
          </div>
        </Container>
        <div className={styles.footerCopyright}>
          <Container maxWidth="xl">
            <Text variant="supporting" color="secondary" as="p">
              © 2026 StreamFlix. All Rights Reserved.
            </Text>
          </Container>
        </div>
      </footer>
    </div>
  );
}
