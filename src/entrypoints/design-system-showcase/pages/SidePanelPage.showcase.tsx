import { useState, type ReactElement } from 'react';
import { CueList } from '@/entrypoints/sidepanel/components/CueList';
import { getMockBilingualCues } from '../mockCues';
import styles from './SidePanelPage.module.css';

const MOCK_CUES = getMockBilingualCues();

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
