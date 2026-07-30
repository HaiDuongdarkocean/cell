import { useState } from 'react';
import type { ReactElement } from 'react';
import { CaptionsButton } from './CaptionsButton';

export function Showcase(): ReactElement {
  const [on, setOn] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <CaptionsButton captionsOn={false} aria-label="Captions off" />
        <CaptionsButton captionsOn aria-label="Captions on" />
        <CaptionsButton available={false} aria-label="Captions unavailable" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <CaptionsButton captionsOn={on} onClick={() => setOn((v) => !v)} />
        <span style={{ fontSize: 12 }}>click to toggle (controlled)</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'CaptionsButton',
  group: 'Domain — Video',
  order: 65,
};
