import { useState, useCallback, useEffect, useRef, type ReactElement } from 'react';
import type { SrtCue } from '@/entities/media';
import jeremyChelseaMp4 from '../design-system-showcase/assets/jeremy-chelsea.mp4?url';
import jeremyChelseaSrt from '../design-system-showcase/assets/jeremy-chelsea.srt?raw';
import jeremyChelseaThumb from '../design-system-showcase/assets/jeremy-chelsea-thumb.jpg?url';
import pleaseAcousticMp4 from '../design-system-showcase/assets/please-acoustic.mp4?url';
import pleaseAcousticSrt from '../design-system-showcase/assets/please-acoustic.srt?raw';
import pleaseAcousticThumb from '../design-system-showcase/assets/please-acoustic-thumb.jpg?url';
import fallInLoveMp4 from '../design-system-showcase/assets/fall-in-love.mp4?url';
import fallInLoveSrt from '../design-system-showcase/assets/fall-in-love.srt?raw';
import fallInLoveThumb from '../design-system-showcase/assets/fall-in-love-thumb.jpg?url';
import apologizeMp4 from '../design-system-showcase/assets/apologize.mp4?url';
import apologizeSrt from '../design-system-showcase/assets/apologize.srt?raw';
import apologizeThumb from '../design-system-showcase/assets/apologize-thumb.jpg?url';
import helloMp4 from '../design-system-showcase/assets/hello.mp4?url';
import helloSrt from '../design-system-showcase/assets/hello.srt?raw';
import helloThumb from '../design-system-showcase/assets/hello-thumb.jpg?url';
import { parseSrt } from '@/shared/lib/parsers/srtParser';
import styles from './YouTubeWatchPage.module.css';
import {
  MenuIcon, SearchIcon, VoiceSearchIcon, CreateIcon, NotificationsIcon,
  LikeIcon, DislikeIcon, ShareIcon, SaveIcon, DownloadIcon,
  HomeIcon, ShortsIcon, SubscriptionsIcon, HistoryIcon,
  ChevronRightIcon, YouIcon, PlaylistsIcon, YourVideosIcon, WatchLaterIcon, LikedIcon,
  TrendingIcon, MusicIcon, MoviesIcon, GamingIcon, LiveIcon, SettingsIcon,
  BellIcon, MoreIcon, VerifiedIcon, ReportIcon,
  YouTubeLogo,
} from './YouTubeIcons';
import { YouTubePlayer } from './YouTubePlayer';
import { YouTubeComments } from './YouTubeComments';

// Channel avatars from clone
import jackAvatar from './assets/Jack.png';
import simonAvatar from './assets/simon.png';
import tomAvatar from './assets/tom.png';
import meganAvatar from './assets/megan.png';
import cameronAvatar from './assets/cameron.png';
import userAvatar from './assets/nilava.jpeg';
import ownerAvatar from './assets/owner.jpg';
import commentAvatar from './assets/Harpreet.jpg';

interface MockVideo {
  readonly id: string;
  readonly title: string;
  readonly channel: string;
  readonly subs: string;
  readonly views: string;
  readonly date: string;
  readonly likes: string;
  readonly duration: string;
  readonly verified: boolean;
  readonly tags: readonly string[];
  readonly description: string;
  readonly mp4: string;
  readonly thumb: string;
  readonly cues: readonly SrtCue[];
}

const VIDEOS: readonly MockVideo[] = [
  {
    id: 'jeremy-chelsea',
    title: 'Jeremy Zucker, Chelsea Cutler - you were good to me (Live in New York)',
    channel: 'Jeremy Zucker',
    subs: '4.2M subscribers',
    views: '18,406,599 views',
    date: 'May 20, 2021',
    likes: '488K',
    duration: '4:16',
    verified: false,
    tags: ['#music', '#live', '#acoustic', '#nyc'],
    description: 'Jeremy Zucker & Chelsea Cutler performing "you were good to me" live in New York.\n\nSubscribe to Jeremy Zucker for more music.',
    mp4: jeremyChelseaMp4,
    thumb: jeremyChelseaThumb,
    cues: parseSrt(jeremyChelseaSrt).cues,
  },
  {
    id: 'please-acoustic',
    title: 'Jeremy Zucker, Chelsea Cutler - please (Acoustic)',
    channel: 'Jeremy Zucker',
    subs: '4.2M subscribers',
    views: '8,123,447 views',
    date: 'Jun 15, 2021',
    likes: '212K',
    duration: '3:48',
    verified: false,
    tags: ['#music', '#acoustic', '#brent'],
    description: 'Acoustic version of "please" by Jeremy Zucker & Chelsea Cutler.\n\nFrom the EP "brent".',
    mp4: pleaseAcousticMp4,
    thumb: pleaseAcousticThumb,
    cues: parseSrt(pleaseAcousticSrt).cues,
  },
  {
    id: 'fall-in-love',
    title: 'Jeremy Zucker, Chelsea Cutler - this is how you fall in love',
    channel: 'Jeremy Zucker',
    subs: '4.2M subscribers',
    views: '12,345,678 views',
    date: 'Jul 8, 2021',
    likes: '356K',
    duration: '3:21',
    verified: false,
    tags: ['#music', '#love', '#brent'],
    description: '"this is how you fall in love" — Jeremy Zucker & Chelsea Cutler.\n\nFrom the EP "brent II".',
    mp4: fallInLoveMp4,
    thumb: fallInLoveThumb,
    cues: parseSrt(fallInLoveSrt).cues,
  },
  {
    id: 'apologize',
    title: 'Timbaland - Apologize ft. OneRepublic',
    channel: 'TimbalandVEVO',
    subs: '3.1M subscribers',
    views: '1,234,567,890 views',
    date: 'Oct 24, 2009',
    likes: '8.9M',
    duration: '3:48',
    verified: false,
    tags: ['#music', '#timbaland', '#onerepublic', '#apologize'],
    description: 'Timbaland - Apologize ft. OneRepublic (Official Music Video).\n\nFrom the album "Shock Value".',
    mp4: apologizeMp4,
    thumb: apologizeThumb,
    cues: parseSrt(apologizeSrt).cues,
  },
  {
    id: 'hello',
    title: 'Adele - Hello (Official Music Video)',
    channel: 'Adele',
    subs: '30.5M subscribers',
    views: '3,567,890,123 views',
    date: 'Oct 22, 2015',
    likes: '16M',
    duration: '4:16',
    verified: true,
    tags: ['#music', '#adele', '#hello', '#25'],
    description: 'Adele - Hello (Official Music Video) from the album 25.\n\nDirected by Xavier Dolan.',
    mp4: helloMp4,
    thumb: helloThumb,
    cues: parseSrt(helloSrt).cues,
  },
];

const SUBSCRIPTIONS = [
  { name: 'Jeremy Zucker', avatar: jackAvatar, live: true },
  { name: 'Adele', avatar: simonAvatar, live: false },
  { name: 'Timbaland', avatar: tomAvatar, live: false },
  { name: 'Chelsea Cutler', avatar: meganAvatar, live: true },
  { name: 'OneRepublic', avatar: cameronAvatar, live: false },
];

const COMMENTS = [
  { name: 'Atinder Kumar', time: '2 days ago', text: 'This song never gets old. The vocals are absolutely timeless.', likes: '1.2K', replies: 9, pinned: true },
  { name: 'Sarah Johnson', time: '5 days ago', text: 'I still remember the first time I heard this. Gave me chills then, still gives me chills now.', likes: '856', replies: 5 },
  { name: 'Emma Williams', time: '1 week ago', text: '2026 and still listening. This is what real music sounds like.', likes: '2.3K', replies: 12 },
  { name: 'Michael Chen', time: '2 weeks ago', text: 'The harmonies in this live version are incredible. Studio version does not compare.', likes: '445', replies: 3 },
  { name: 'Olivia Brown', time: '3 weeks ago', text: 'Came here after hearing this in a coffee shop. Could not stop thinking about it.', likes: '312', replies: 1 },
  { name: 'David Lee', time: '1 month ago', text: 'This is the kind of song that heals the soul. Thank you for making this.', likes: '891', replies: 7 },
  { name: 'Sophia Martinez', time: '1 month ago', text: 'The acoustic arrangement is pure perfection. Every note hits right.', likes: '567', replies: 2 },
  { name: 'James Wilson', time: '2 months ago', text: 'Still my go-to song when I need to feel something real.', likes: '234', replies: 0 },
];

const CHIPS = ['All', 'Music', 'Gaming', 'Live', 'Mixes', 'Podcasts', 'News', 'Computer programming', 'Recently uploaded', 'New to you'];

const SEARCH_SUGGESTIONS = [
  'adele hello', 'adele easy on me', 'adele someone like you',
  'adele rolling in the deep', 'adele set fire to the rain', 'adele when we were young',
];

const FOOTER_LINKS = [
  'About', 'Press', 'Copyright', 'Contact us', 'Creators', 'Advertise', 'Developers',
  'Terms', 'Privacy', 'Policy & Safety', 'How YouTube works', 'Test new features',
];

const MINI_GUIDE = [
  { icon: 'home', label: 'Home' },
  { icon: 'shorts', label: 'Shorts' },
  { icon: 'subscriptions', label: 'Subscriptions' },
  { icon: 'you', label: 'You' },
] as const;

const EXPLORE_ITEMS = [
  { icon: 'trending', label: 'Trending' },
  { icon: 'music', label: 'Music' },
  { icon: 'movies', label: 'Movies' },
  { icon: 'gaming', label: 'Gaming' },
  { icon: 'live', label: 'Live' },
  { icon: 'settings', label: 'Settings' },
] as const;

const YOU_ITEMS = [
  { icon: 'history', label: 'History' },
  { icon: 'playlists', label: 'Playlists' },
  { icon: 'yourvideos', label: 'Your videos' },
  { icon: 'watchlater', label: 'Watch later' },
  { icon: 'liked', label: 'Liked videos' },
] as const;

type GuideIconName = 'home' | 'shorts' | 'subscriptions' | 'library' | 'history'
  | 'you' | 'playlists' | 'yourvideos' | 'watchlater' | 'liked'
  | 'trending' | 'music' | 'movies' | 'gaming' | 'live' | 'settings';

function GuideIcon({ name }: { readonly name: GuideIconName }): ReactElement {
  const icon = (() => {
    switch (name) {
      case 'home': return <HomeIcon size={24} />;
      case 'shorts': return <ShortsIcon size={24} />;
      case 'subscriptions': return <SubscriptionsIcon size={24} />;
      case 'history': return <HistoryIcon size={24} />;
      case 'you': return <YouIcon size={24} />;
      case 'playlists': return <PlaylistsIcon size={24} />;
      case 'yourvideos': return <YourVideosIcon size={24} />;
      case 'watchlater': return <WatchLaterIcon size={24} />;
      case 'liked': return <LikedIcon size={24} />;
      case 'trending': return <TrendingIcon size={24} />;
      case 'music': return <MusicIcon size={24} />;
      case 'movies': return <MoviesIcon size={24} />;
      case 'gaming': return <GamingIcon size={24} />;
      case 'live': return <LiveIcon size={24} />;
      case 'settings': return <SettingsIcon size={24} />;
      default: return <HomeIcon size={24} />;
    }
  })();
  return <span className={styles.guideItemIcon}>{icon}</span>;
}

function VerifiedBadge(): ReactElement {
  return (
    <span className={styles.verifiedBadge} aria-label="Verified">
      <VerifiedIcon size={14} />
    </span>
  );
}

function DurationBadge({ duration }: { readonly duration: string }): ReactElement {
  return <span className={styles.durationBadge}>{duration}</span>;
}

function MoreMenuButton(): ReactElement {
  return (
    <button
      className={styles.moreMenuBtn}
      aria-label="More options"
      onClick={(e) => { e.stopPropagation(); }}
    >
      <MoreIcon size={20} />
    </button>
  );
}

type View = 'home' | 'watch';
type MobileNav = 'home' | 'shorts' | 'subs' | 'you';

export function YouTubeWatchPage(): ReactElement {
  const [view, setView] = useState<View>('home');
  const [activeIdx, setActiveIdx] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeBounce, setLikeBounce] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [activeChip, setActiveChip] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showMoreSubs, setShowMoreSubs] = useState(false);
  const [activeNav, setActiveNav] = useState<MobileNav>('home');
  const [overflowOpen, setOverflowOpen] = useState(false);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  const guideOverlayRef = useRef<HTMLDivElement>(null);

  const activeVideo = VIDEOS[activeIdx] ?? VIDEOS[0];

  // Close search suggestions on outside click.
  // Early-return when the click lands inside the search wrap (including the
  // input itself) so the mousedown that precedes focus never closes the dropdown.
  useEffect(() => {
    if (!searchFocused) return;
    function handleOutsideClick(e: MouseEvent): void {
      if (searchWrapRef.current?.contains(e.target as Node)) return;
      setSearchFocused(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [searchFocused]);

  // Close guide overlay on outside click or Escape (watch page only).
  useEffect(() => {
    if (!guideOpen) return;
    function handleGuideOutside(e: MouseEvent): void {
      if (guideOverlayRef.current?.contains(e.target as Node)) return;
      setGuideOpen(false);
    }
    function handleEscape(e: KeyboardEvent): void {
      if (e.key === 'Escape') setGuideOpen(false);
    }
    document.addEventListener('mousedown', handleGuideOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleGuideOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [guideOpen]);

  // Close overflow menu on outside click or Escape.
  useEffect(() => {
    if (!overflowOpen) return;
    function handleOverflowOutside(e: MouseEvent): void {
      if (overflowRef.current?.contains(e.target as Node)) return;
      setOverflowOpen(false);
    }
    function handleEscape(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOverflowOpen(false);
    }
    document.addEventListener('mousedown', handleOverflowOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOverflowOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [overflowOpen]);

  const openVideo = useCallback((idx: number) => {
    setActiveIdx(idx);
    setView('watch');
    setLiked(false);
    setLikeBounce(false);
    setDescExpanded(false);
    setSubscribed(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goHome = useCallback(() => {
    setView('home');
    setActiveNav('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleSidebar = useCallback(() => {
    if (view === 'watch') {
      setGuideOpen(o => !o);
    } else {
      setSidebarCollapsed(c => !c);
    }
  }, [view]);

  const handleLike = useCallback(() => {
    setLiked(l => !l);
    setLikeBounce(true);
    window.setTimeout(() => setLikeBounce(false), 300);
  }, []);

  const handleSubscribe = useCallback(() => setSubscribed(s => !s), []);

  const handleSuggestionClick = useCallback((s: string) => {
    setSearchValue(s);
    setSearchFocused(false);
  }, []);

  const filteredSuggestions = searchValue
    ? SEARCH_SUGGESTIONS.filter(s => s.toLowerCase().includes(searchValue.toLowerCase()))
    : SEARCH_SUGGESTIONS;

  const visibleSubs = showMoreSubs ? SUBSCRIPTIONS : SUBSCRIPTIONS.slice(0, 4);

  return (
    <div className={styles.page}>
      {/* === Masthead (frosted glass) === */}
      <header className={styles.masthead} role="banner">
        <div className={styles.mastheadStart}>
          <button
            className={styles.iconButton}
            onClick={toggleSidebar}
            aria-label="Guide"
          >
            <MenuIcon size={24} />
          </button>
          <a className={styles.logoLink} onClick={goHome} aria-label="YouTube Home">
            <YouTubeLogo className={styles.logoSvg} />
          </a>
        </div>
        <div className={styles.mastheadCenter}>
          <div className={styles.searchWrap} ref={searchWrapRef}>
            <div className={`${styles.searchContainer} ${searchFocused ? styles.searchContainerFocused : ''}`}>
              {searchFocused && (
                <span className={styles.searchInnerIcon}><SearchIcon size={24} /></span>
              )}
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Search"
                value={searchValue}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => setSearchValue(e.target.value)}
              />
              <button className={styles.searchButton} aria-label="Search">
                <SearchIcon size={24} />
              </button>
            </div>
            {searchFocused && filteredSuggestions.length > 0 && (
              <ul className={styles.suggestionsDropdown} role="listbox">
                {filteredSuggestions.map(s => (
                  <li
                    key={s}
                    className={styles.suggestionItem}
                    onClick={() => handleSuggestionClick(s)}
                    role="option"
                    aria-selected="false"
                  >
                    <span className={styles.suggestionIcon}><SearchIcon size={20} /></span>
                    <span className={styles.suggestionText}>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className={styles.voiceButton} aria-label="Search with your voice">
            <VoiceSearchIcon size={24} />
          </button>
        </div>
        <div className={styles.mastheadEnd}>
          {view === 'watch' ? (
            <>
              <button className={styles.iconButton} aria-label="More">
                <MoreIcon size={24} />
              </button>
              <button className={styles.signInBtn} type="button">
                <span className={styles.signInAvatar} aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </span>
                Sign in
              </button>
            </>
          ) : (
            <>
              <button className={styles.iconButton} aria-label="Create">
                <CreateIcon size={24} />
              </button>
              <button className={styles.iconButton} aria-label="Notifications" style={{ position: 'relative' }}>
                <NotificationsIcon size={24} />
                <span className={styles.notifBadge}>9+</span>
              </button>
              <button className={styles.avatarButton} aria-label="Account">
                <img src={userAvatar} alt="User avatar" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* === Guide / Sidebar === */}
      <aside className={`${styles.guide} ${sidebarCollapsed ? styles.guideCollapsed : ''} ${view === 'watch' ? styles.guideHidden : ''}`} role="navigation">
        {sidebarCollapsed ? (
          /* Mini-guide: 4 main items */
          <div className={styles.miniGuide}>
            {MINI_GUIDE.map(item => (
              <button
                key={item.label}
                className={`${styles.miniGuideItem} ${view === 'home' && item.icon === 'home' ? styles.guideItemActive : ''}`}
                onClick={() => item.icon === 'home' && goHome()}
              >
                <GuideIcon name={item.icon} />
                <span className={styles.miniGuideLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Section 1: Home / Shorts / Subscriptions / You */}
            <div className={styles.guideSection}>
              <button
                className={`${styles.guideItem} ${view === 'home' ? styles.guideItemActive : ''}`}
                onClick={goHome}
              >
                <GuideIcon name="home" />
                <span className={styles.guideLabel}>Home</span>
              </button>
              <button className={styles.guideItem}>
                <GuideIcon name="shorts" />
                <span className={styles.guideLabel}>Shorts</span>
              </button>
              <button className={styles.guideItem}>
                <GuideIcon name="subscriptions" />
                <span className={styles.guideLabel}>Subscriptions</span>
              </button>
              <button className={styles.guideItem}>
                <GuideIcon name="you" />
                <span className={styles.guideLabel}>You</span>
                <span className={styles.chevronRight}><ChevronRightIcon size={24} /></span>
              </button>
            </div>

            {/* Section 2: You > History / Playlists / Your videos / Watch later / Liked videos */}
            <div className={styles.guideSection}>
              <div className={styles.guideSectionTitle}>You</div>
              {YOU_ITEMS.map(item => (
                <button key={item.label} className={styles.guideItem}>
                  <GuideIcon name={item.icon} />
                  <span className={styles.guideLabel}>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Section 3: Subscriptions with live indicators + Show more/less */}
            <div className={styles.guideSection}>
              <div className={styles.guideSectionTitle}>Subscriptions</div>
              {visibleSubs.map(s => (
                <button key={s.name} className={styles.guideItem}>
                  <span className={styles.guideSubAvatarWrap}>
                    <img className={styles.guideSubAvatar} src={s.avatar} alt="" />
                    {s.live && <span className={styles.liveDot} />}
                  </span>
                  <span className={styles.guideLabel}>{s.name}</span>
                  {s.live && <span className={styles.liveBadge}>LIVE</span>}
                </button>
              ))}
              <button
                className={styles.guideItem}
                onClick={() => setShowMoreSubs(v => !v)}
              >
                <span className={styles.guideItemIcon}><ChevronRightIcon size={24} /></span>
                <span className={styles.guideLabel}>{showMoreSubs ? 'Show less' : 'Show more'}</span>
              </button>
            </div>

            {/* Section 4: Explore */}
            <div className={styles.guideSection}>
              <div className={styles.guideSectionTitle}>Explore</div>
              {EXPLORE_ITEMS.map(item => (
                <button key={item.label} className={styles.guideItem}>
                  <GuideIcon name={item.icon} />
                  <span className={styles.guideLabel}>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Section 5: Footer */}
            <div className={styles.guideFooter}>
              <div className={styles.footerLinks}>
                {FOOTER_LINKS.map(link => (
                  <a key={link} className={styles.footerLink}>{link}</a>
                ))}
              </div>
              <p className={styles.footerCopyright}>© 2026 Google LLC</p>
            </div>
          </>
        )}
      </aside>

      {/* === Guide overlay (watch page only) === */}
      {view === 'watch' && guideOpen && (
        <div className={styles.guideOverlay} onClick={() => setGuideOpen(false)}>
          <div ref={guideOverlayRef} className={styles.guideOverlayPanel} onClick={e => e.stopPropagation()}>
            <div className={styles.guideSection}>
              <button
                className={styles.guideItem}
                onClick={() => { goHome(); setGuideOpen(false); }}
              >
                <GuideIcon name="home" />
                <span className={styles.guideLabel}>Home</span>
              </button>
              <button className={styles.guideItem}>
                <GuideIcon name="shorts" />
                <span className={styles.guideLabel}>Shorts</span>
              </button>
              <button className={styles.guideItem}>
                <GuideIcon name="subscriptions" />
                <span className={styles.guideLabel}>Subscriptions</span>
              </button>
            </div>
            <div className={styles.guideSection}>
              <div className={styles.guideSectionTitle}>You</div>
              {YOU_ITEMS.map(item => (
                <button key={item.label} className={styles.guideItem}>
                  <GuideIcon name={item.icon} />
                  <span className={styles.guideLabel}>{item.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.guideSection}>
              <div className={styles.guideSectionTitle}>Explore</div>
              {EXPLORE_ITEMS.map(item => (
                <button key={item.label} className={styles.guideItem}>
                  <GuideIcon name={item.icon} />
                  <span className={styles.guideLabel}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === Content === */}
      <div className={`${styles.content} ${view === 'watch' ? styles.contentWatch : sidebarCollapsed ? styles.contentCollapsed : ''}`}>
        {view === 'home' ? (
          /* === Home: Chips + Video Grid === */
          <>
            <div className={styles.chipsBar}>
              <div className={styles.chipsScroll}>
                {CHIPS.map((chip, i) => (
                  <button
                    key={chip}
                    className={`${styles.chip} ${i === activeChip ? styles.chipActive : ''}`}
                    onClick={() => setActiveChip(i)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.videoGrid}>
              {VIDEOS.map((v, i) => (
                <div key={v.id} className={styles.videoCard} onClick={() => openVideo(i)}>
                  <div className={styles.thumbWrap}>
                    <img className={styles.videoThumb} src={v.thumb} alt={v.title} loading="lazy" />
                    <DurationBadge duration={v.duration} />
                    <MoreMenuButton />
                  </div>
                  <div className={styles.videoMeta}>
                    <img className={styles.channelAvatar} src={userAvatar} alt="" />
                    <div className={styles.videoInfo}>
                      <p className={styles.videoTitle}>{v.title}</p>
                      <p className={styles.videoChannel}>
                        {v.channel}
                        {v.verified && <VerifiedBadge />}
                      </p>
                      <p className={styles.videoStats}>{v.views} {'\u00b7'} {v.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* === Watch Page === */
          <div className={`${styles.watchRow} ${styles.fadeIn}`}>
            {/* === Primary === */}
            <div className={styles.primary}>
              {/* Player */}
              <YouTubePlayer
                mp4={activeVideo.mp4}
                cues={activeVideo.cues}
                title={activeVideo.title}
              />

              {/* Metadata */}
              <div className={styles.watchMetadata}>
                <h1 className={styles.watchTitle}>{activeVideo.title}</h1>

                {/* Info row: channel + actions */}
                <div className={styles.watchInfoRow}>
                  <div className={styles.watchInfoLeft}>
                    <img className={styles.ownerAvatar} src={ownerAvatar} alt={activeVideo.channel} />
                    <div className={styles.ownerInfo}>
                      <span className={styles.ownerName}>
                        {activeVideo.channel}
                        {activeVideo.verified && <VerifiedBadge />}
                      </span>
                      <span className={styles.ownerSubs}>{activeVideo.subs}</span>
                    </div>
                    <button
                      className={`${styles.subscribeBtn} ${subscribed ? styles.subscribed : ''}`}
                      type="button"
                      onClick={handleSubscribe}
                      aria-pressed={subscribed}
                    >
                      {subscribed ? (
                        <>
                          <span className={styles.subBellIcon}><BellIcon size={18} /></span>
                          Subscribed
                        </>
                      ) : 'Subscribe'}
                    </button>
                  </div>

                  <div className={styles.actionBar}>
                    <div className={styles.likeDislikeGroup}>
                      <button
                        className={`${styles.likeBtn} ${liked ? styles.likedActive : ''} ${likeBounce ? styles.likeBounce : ''}`}
                        onClick={handleLike}
                        aria-pressed={liked}
                        aria-label={`like this video along with ${activeVideo.likes} other people`}
                      >
                        <span className={styles.actionBtnIcon}><LikeIcon size={18} /></span>
                        {liked ? `${activeVideo.likes} +1` : activeVideo.likes}
                      </button>
                      <button className={styles.dislikeBtn} aria-label="Dislike this video">
                        <span className={styles.actionBtnIcon}><DislikeIcon size={18} /></span>
                      </button>
                    </div>
                    <button className={styles.actionBtn} aria-label="Share">
                      <span className={styles.actionBtnIcon}><ShareIcon size={18} /></span>
                      Share
                    </button>
                    <button className={styles.actionBtn} aria-label="Download">
                      <span className={styles.actionBtnIcon}><DownloadIcon size={18} /></span>
                      Download
                    </button>
                    <button className={styles.actionBtn} aria-label="Save to playlist">
                      <span className={styles.actionBtnIcon}><SaveIcon size={18} /></span>
                      Save
                    </button>
                    <div ref={overflowRef} style={{ position: 'relative' }}>
                      <button
                        className={styles.actionBtn}
                        aria-label="More actions"
                        onClick={(e) => { e.stopPropagation(); setOverflowOpen(o => !o); }}
                      >
                        <span className={styles.actionBtnIcon}><MoreIcon size={18} /></span>
                      </button>
                      {overflowOpen && (
                        <div className={styles.overflowMenu} onClick={(e) => e.stopPropagation()}>
                          <button className={styles.overflowRow}>
                            <ReportIcon size={18} /> Report
                          </button>
                          <button className={styles.overflowRow}>
                            Show transcript
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description with expand/collapse */}
                <div
                  className={`${styles.description} ${descExpanded ? styles.descExpanded : ''}`}
                  onClick={() => setDescExpanded(e => !e)}
                >
                  <div className={styles.descInfoRow}>
                    <span>{activeVideo.views}</span>
                    <span className={styles.descViews}>{activeVideo.date}</span>
                  </div>
                  <div className={styles.descBody}>
                    <p className={styles.descText}>
                      <span className={styles.descChannelPrefix}>{activeVideo.channel}</span>
                      {' '}
                      {activeVideo.description}
                    </p>
                    <div className={styles.descTags}>
                      {activeVideo.tags.map(t => <span key={t} className={styles.descTag}>{t}</span>)}
                    </div>
                  </div>
                  <button className={styles.descToggle} type="button">
                    {descExpanded ? 'Show less' : '...more'}
                  </button>
                </div>

                {/* Comments */}
                <YouTubeComments
                  comments={COMMENTS}
                  channelName={activeVideo.channel}
                  userAvatar={userAvatar}
                  commentAvatar={commentAvatar}
                />
              </div>
            </div>

            {/* === Secondary: Related Videos === */}
            <div className={styles.secondary}>
              <div className={styles.relatedList}>
                {VIDEOS.map((v, i) => i !== activeIdx && (
                  <button
                    key={v.id}
                    className={styles.relatedItem}
                    onClick={() => openVideo(i)}
                    aria-label={`Play ${v.title}`}
                  >
                    <div className={styles.relatedThumbWrap}>
                      <img className={styles.relatedThumb} src={v.thumb} alt={v.title} loading="lazy" />
                      <DurationBadge duration={v.duration} />
                      <MoreMenuButton />
                    </div>
                    <div className={styles.relatedInfo}>
                      <p className={styles.relatedTitle}>{v.title}</p>
                      <p className={styles.relatedChannel}>
                        {v.channel}
                        {v.verified && <VerifiedBadge />}
                      </p>
                      <p className={styles.relatedMeta}>{v.views} {'\u00b7'} {v.date}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === Mobile bottom nav (<792px) === */}
      <nav className={styles.bottomNav} role="navigation" aria-label="Mobile navigation">
        <button
          className={`${styles.bottomNavItem} ${activeNav === 'home' ? styles.bottomNavActive : ''}`}
          onClick={() => { setActiveNav('home'); goHome(); }}
        >
          <HomeIcon size={24} />
          <span className={styles.bottomNavLabel}>Home</span>
        </button>
        <button
          className={`${styles.bottomNavItem} ${activeNav === 'shorts' ? styles.bottomNavActive : ''}`}
          onClick={() => setActiveNav('shorts')}
        >
          <ShortsIcon size={24} />
          <span className={styles.bottomNavLabel}>Shorts</span>
        </button>
        <button className={styles.bottomNavPlus} aria-label="Create">
          <span className={styles.bottomNavPlusIcon}>+</span>
        </button>
        <button
          className={`${styles.bottomNavItem} ${activeNav === 'subs' ? styles.bottomNavActive : ''}`}
          onClick={() => setActiveNav('subs')}
        >
          <SubscriptionsIcon size={24} />
          <span className={styles.bottomNavLabel}>Subscriptions</span>
        </button>
        <button
          className={`${styles.bottomNavItem} ${activeNav === 'you' ? styles.bottomNavActive : ''}`}
          onClick={() => setActiveNav('you')}
        >
          <YouIcon size={24} />
          <span className={styles.bottomNavLabel}>You</span>
        </button>
      </nav>
    </div>
  );
}
