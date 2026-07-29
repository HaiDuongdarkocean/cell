import { useState, type ReactElement } from 'react';
import { Toggle } from './Toggle';

export function Showcase(): ReactElement {
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
      <Toggle checked={on} onChange={setOn} ariaLabel="Toggle on" title="Enabled toggle" />
      <Toggle checked={off} onChange={setOff} ariaLabel="Toggle off" title="Off toggle" />
      <Toggle checked={off} onChange={setOff} ariaLabel="Disabled toggle" title="Disabled" disabled />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Toggle',
  group: 'Shared UI — Input',
  order: 22,
};
