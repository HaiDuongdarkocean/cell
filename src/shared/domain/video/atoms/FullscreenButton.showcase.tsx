import { useState } from 'react';
import type { ReactElement } from 'react';
import { FullscreenButton } from './FullscreenButton';

export function Showcase(): ReactElement {
  const [fs, setFs] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <FullscreenButton fullscreen={false} aria-label="Enter fullscreen" />
        <FullscreenButton fullscreen aria-label="Exit fullscreen" />
        <FullscreenButton disabled aria-label="Fullscreen disabled" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <FullscreenButton fullscreen={fs} onClick={() => setFs((v) => !v)} />
        <span style={{ fontSize: 12 }}>click to toggle (controlled)</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'FullscreenButton',
  group: 'Domain — Video',
  order: 66,
};
