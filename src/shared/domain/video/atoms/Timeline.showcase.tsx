import { useState } from 'react';
import type { ReactElement } from 'react';
import { Timeline } from './Timeline';

export function Showcase(): ReactElement {
  const [time, setTime] = useState(35);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
      <Timeline currentTime={time} duration={120} buffered={80} onSeek={setTime} />
      <span>currentTime: {time}s / 120s</span>
      <Timeline currentTime={0} duration={120} buffered={0} onSeek={() => {}} />
      <span>Not started</span>
      <Timeline currentTime={60} duration={120} buffered={120} onSeek={() => {}} />
      <span>Halfway</span>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Timeline',
  level: 'molecules',
  category: 'Action',
  group: 'Domain — Video',
  order: 61,
};
