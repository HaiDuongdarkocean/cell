import { useState } from 'react';
import type { ReactElement } from 'react';
import { PlayPauseButton } from './PlayPauseButton';

export function Showcase(): ReactElement {
  const [playing, setPlaying] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <PlayPauseButton playing={playing} onClick={() => setPlaying((p) => !p)} />
        <span>{playing ? 'Playing' : 'Paused'}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <PlayPauseButton playing={true} />
        <span>Playing (controlled)</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <PlayPauseButton playing={false} loading={true} />
        <span>Buffering</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'PlayPauseButton',
  level: 'molecules',
  category: 'Action',
  group: 'Domain — Video',
  order: 60,
};
