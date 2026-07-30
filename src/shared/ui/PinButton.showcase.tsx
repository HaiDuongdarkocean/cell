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
  group: 'Extension',
  order: 45,
};
