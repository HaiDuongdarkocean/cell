import { useState } from 'react';
import { CueList } from '@/features/subtitle/ui/CueList';
import { MOCK_CUES } from './mockData';
import styles from './mockup.module.css';

export function RealPanel(): React.ReactElement {
  const [timeMs, setTimeMs] = useState(4000);
  return (
    <div className={styles.panel}>
      <CueList
        cues={MOCK_CUES}
        currentTimeMs={timeMs}
        onSeek={setTimeMs}
        tokenize={{
          langCode: 'en',
          onTokenClick: () => {},
        }}
      />
    </div>
  );
}
