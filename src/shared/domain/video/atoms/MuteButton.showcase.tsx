import { useState } from 'react';
import type { ReactElement } from 'react';
import { MuteButton } from './MuteButton';

export function Showcase(): ReactElement {
  const [muted, setMuted] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <MuteButton muted={muted} volume={0.8} onClick={() => setMuted((m) => !m)} />
        <span>{muted ? 'Muted' : 'Unmuted'}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <MuteButton muted={false} volume={0.3} />
        <span>Low volume</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <MuteButton muted={true} volume={0.8} />
        <span>Muted (high vol)</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'MuteButton',
  level: 'molecules',
  category: 'Action',
  group: 'Domain — Video',
  order: 64,
};
