import { useState, type ReactElement } from 'react';
import { PinButton } from './PinButton';

export function Showcase(): ReactElement {
  const [pinned, setPinned] = useState(false);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <PinButton pinned={pinned} onClick={() => setPinned(!pinned)} />
      <PinButton pinned={true} />
      <PinButton pinned={false} disabled />
    </div>
  );
}

export const showcaseMeta = {
  title: 'PinButton',
  description: 'Pin toggle button with pinned/unpinned states and sizes (sm, md, lg). Use for pinning items.',
  level: 'atoms',
  category: 'Action',
  group: 'Extension',
  order: 45,
};
