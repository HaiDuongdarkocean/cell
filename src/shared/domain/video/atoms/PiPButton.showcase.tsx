import { useState } from 'react';
import type { ReactElement } from 'react';
import { PiPButton } from './PiPButton';

export function Showcase(): ReactElement {
  const [pip, setPip] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <PiPButton pip={false} aria-label="Enter picture-in-picture" />
        <PiPButton pip aria-label="Exit picture-in-picture" />
        <PiPButton disabled aria-label="PiP disabled" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <PiPButton pip={pip} onClick={() => setPip((v) => !v)} />
        <span style={{ fontSize: 12 }}>click to toggle (controlled)</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'PiPButton',
  level: 'molecules',
  category: 'Action',
  group: 'Domain — Video',
  order: 67,
};
