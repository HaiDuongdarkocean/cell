import { useState, useCallback, type ReactElement } from 'react';
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
  HomeIcon, ShortsIcon, SubscriptionsIcon, LibraryIcon, HistoryIcon,
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

const GUIDE_ITEMS = [
  { icon: 'home', label: 'Home' },
  { icon: 'shorts', label: 'Shorts' },
  { icon: 'subscriptions', label: 'Subscriptions' },
];

const GUIDE_ITEMS_2 = [
  { icon: 'library', label: 'Library' },
  { icon: 'history', label: 'History' },
];

function GuideIcon({ name }: { readonly name: string }): ReactElement {
  const icon = (() => {
    switch (name) {
      case 'home': return <HomeIcon size={24} />;
      case 'shorts': return <ShortsIcon size={24} />;
      case 'subscriptions': return <SubscriptionsIcon size={24} />;
      case 'library': return <LibraryIcon size={24} />;
      case 'history': return <HistoryIcon size={24} />;
      default: return <HomeIcon size={24} />;
    }
  })();
  return <span className={styles.guideItemIcon}>{icon}</span>;
}

type View = 'home' | 'watch';

export function YouTubeWatchPage(): ReactElement {
  const [view, setView] = useState<View>('home');
  const [activeIdx, setActiveIdx] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [liked, setLiked] = useState(false);

  const activeVideo = VIDEOS[activeIdx] ?? VIDEOS[0];

  const openVideo = useCallback((idx: number) => {
    setActiveIdx(idx);
    setView('watch');
    setLiked(false);
    setDescExpanded(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goHome = useCallback(() => {
    setView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed(c => !c), []);

  return (
    <div className={styles.page}>
      {/* === Masthead === */}
      <header className={styles.masthead} role="banner">
        <div className={styles.mastheadStart}>
          <button className={styles.iconButton} onClick={toggleSidebar} aria-label="Guide">
            <MenuIcon size={24} />
          </button>
          <a className={styles.logoLink} onClick={goHome} aria-label="YouTube Home">
            <YouTubeLogo className={styles.logoSvg} />
          </a>
        </div>
        <div className={styles.mastheadCenter}>
          <div className={styles.searchContainer}>
            <input className={styles.searchInput} type="text" placeholder="Search" />
            <button className={styles.searchButton} aria-label="Search">
              <SearchIcon size={24} />
            </button>
          </div>
          <button className={styles.voiceButton} aria-label="Search with your voice">
            <VoiceSearchIcon size={24} />
          </button>
        </div>
        <div className={styles.mastheadEnd}>
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
        </div>
      </header>

      {/* === Guide / Sidebar === */}
      <aside className={`${styles.guide} ${sidebarCollapsed ? styles.guideCollapsed : ''}`} role="navigation">
        <div className={styles.guideSection}>
          {GUIDE_ITEMS.map(item => (
            <button
              key={item.label}
              className={`${styles.guideItem} ${view === 'home' && item.icon === 'home' ? styles.guideItemActive : ''}`}
              onClick={() => item.icon === 'home' && goHome()}
            >
              <GuideIcon name={item.icon} />
              <span className={styles.guideLabel}>{item.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.guideSection}>
          {GUIDE_ITEMS_2.map(item => (
            <button key={item.label} className={styles.guideItem}>
              <GuideIcon name={item.icon} />
              <span className={styles.guideLabel}>{item.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.guideSection}>
          <div className={styles.guideSectionTitle}>Subscriptions</div>
          {SUBSCRIPTIONS.map(s => (
            <button key={s.name} className={styles.guideItem}>
              <img className={styles.guideSubAvatar} src={s.avatar} alt="" />
              <span className={styles.guideLabel}>{s.name}{s.live ? ' \u2022' : ''}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* === Content === */}
      <div className={`${styles.content} ${sidebarCollapsed ? styles.contentCollapsed : ''}`}>
        {view === 'home' ? (
          /* === Home: Video Grid === */
          <div className={styles.videoGrid}>
            {VIDEOS.map((v, i) => (
              <div key={v.id} className={styles.videoCard} onClick={() => openVideo(i)}>
                <img className={styles.videoThumb} src={v.thumb} alt={v.title} loading="lazy" />
                <div className={styles.videoMeta}>
                  <img className={styles.channelAvatar} src={userAvatar} alt="" />
                  <div className={styles.videoInfo}>
                    <p className={styles.videoTitle}>{v.title}</p>
                    <p className={styles.videoChannel}>{v.channel}</p>
                    <p className={styles.videoStats}>{v.views} {'\u00b7'} {v.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                      <span className={styles.ownerName}>{activeVideo.channel}</span>
                      <span className={styles.ownerSubs}>{activeVideo.subs}</span>
                    </div>
                    <button className={styles.subscribeBtn} type="button">Subscribe</button>
                  </div>

                  <div className={styles.actionBar}>
                    <div className={styles.likeDislikeGroup}>
                      <button
                        className={styles.likeBtn}
                        onClick={() => setLiked(l => !l)}
                        aria-pressed={liked}
                        aria-label={`like this video along with ${activeVideo.likes} other people`}
                      >
                        <span className={styles.actionBtnIcon}><LikeIcon size={18} /></span>
                        {liked ? activeVideo.likes : activeVideo.likes}
                      </button>
                      <button className={styles.dislikeBtn} aria-label="Dislike this video">
                        <span className={styles.actionBtnIcon}><DislikeIcon size={18} /></span>
                      </button>
                    </div>
                    <button className={styles.actionBtn} aria-label="Share">
                      <span className={styles.actionBtnIcon}><ShareIcon size={18} /></span>
                      Share
                    </button>
                    <button className={styles.actionBtn} aria-label="Save to playlist">
                      <span className={styles.actionBtnIcon}><SaveIcon size={18} /></span>
                      Save
                    </button>
                    <button className={styles.actionBtn} aria-label="Download">
                      <span className={styles.actionBtnIcon}><DownloadIcon size={18} /></span>
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div
                  className={`${styles.description} ${descExpanded ? styles.descExpanded : ''}`}
                  onClick={() => setDescExpanded(e => !e)}
                >
                  <div className={styles.descInfoRow}>
                    <span>{activeVideo.views}</span>
                    <span className={styles.descViews}>{activeVideo.date}</span>
                  </div>
                  <p className={styles.descText}>{activeVideo.description}</p>
                  <div className={styles.descTags}>
                    {activeVideo.tags.map(t => <span key={t} className={styles.descTag}>{t}</span>)}
                  </div>
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
                    <img className={styles.relatedThumb} src={v.thumb} alt={v.title} loading="lazy" />
                    <div className={styles.relatedInfo}>
                      <p className={styles.relatedTitle}>{v.title}</p>
                      <p className={styles.relatedChannel}>{v.channel}</p>
                      <p className={styles.relatedMeta}>{v.views} {'\u00b7'} {v.date}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
