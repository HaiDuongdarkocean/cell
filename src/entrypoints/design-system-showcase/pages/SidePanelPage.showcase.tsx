import { useState, type ReactElement } from 'react';
import { CueList } from '@/entrypoints/sidepanel/components/CueList';
import type { BilingualCue } from '@/entities/media';
import styles from './SidePanelPage.module.css';

const MOCK_CUES: BilingualCue[] = [
  { index: 1, start: 0, end: 3000, targetText: 'Hello, welcome to the show.', nativeText: 'Xin chào, chào mừng đến chương trình.' },
  { index: 2, start: 3200, end: 6000, targetText: 'Today we are learning languages.', nativeText: 'Hôm nay chúng ta học ngôn ngữ.' },
  { index: 3, start: 6200, end: 9000, targetText: 'Please repeat after me.', nativeText: 'Hãy nhắc lại sau tôi.' },
  { index: 4, start: 9200, end: 12000, targetText: 'Language learning is a journey.', nativeText: 'Học ngôn ngữ là một hành trình.' },
  { index: 5, start: 12200, end: 15000, targetText: 'Every word brings you closer.', nativeText: 'Mỗi từ đưa bạn đến gần hơn.' },
];

export function Showcase(): ReactElement {
  const [currentTimeMs, setCurrentTimeMs] = useState(4500);

  return (
    <div className={styles.wrapper}>
      <div className={styles.browserFrame}>
        <div className={styles.browserHeader}>
          <span className={styles.browserDot} />
          <span className={styles.browserDot} />
          <span className={styles.browserDot} />
          <span className={styles.browserUrl}>chrome://side-panel · Cell</span>
        </div>
        <div className={styles.panelBody}>
          <CueList
            cues={MOCK_CUES}
            currentTimeMs={currentTimeMs}
            onSeek={(ms) => setCurrentTimeMs(ms)}
          />
          <div className={styles.timeControl}>
            <label htmlFor="sidepanel-time">Current time: {(currentTimeMs / 1000).toFixed(1)}s</label>
            <input
              id="sidepanel-time"
              type="range"
              min={0}
              max={15000}
              step={100}
              value={currentTimeMs}
              onChange={(e) => setCurrentTimeMs(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Side Panel Page',
  description: 'Chrome side panel showing bilingual subtitle cue list with active highlight, auto-scroll, and click-to-seek. Synced with video playback time.',
  level: 'pages' as const,
  category: 'Side Panel',
  order: 40,
};
