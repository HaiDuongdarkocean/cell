import { useState } from 'react';
import type { ReactElement } from 'react';
import { VolumeControl } from './VolumeControl';

export function Showcase(): ReactElement {
  const [volume, setVolume] = useState(0.6);
  const [muted, setMuted] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <VolumeControl
        volume={volume}
        muted={muted}
        onVolumeChange={setVolume}
        onMuteToggle={() => setMuted((m) => !m)}
      />
      <span>volume: {Math.round(volume * 100)}% — {muted ? 'muted' : 'unmuted'}</span>
      <VolumeControl volume={0} muted={true} onVolumeChange={() => {}} onMuteToggle={() => {}} />
      <span>Muted</span>
      <VolumeControl volume={1} muted={false} onVolumeChange={() => {}} onMuteToggle={() => {}} />
      <span>Full volume</span>
    </div>
  );
}

export const showcaseMeta = {
  title: 'VolumeControl',
  level: 'molecules',
  category: 'Action',
  group: 'Domain — Video',
  order: 63,
};
