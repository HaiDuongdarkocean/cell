import type { ReactElement } from 'react';
import { MinimizeButton } from './MinimizeButton';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <MinimizeButton />
      <MinimizeButton ariaLabel="Hide panel" />
      <MinimizeButton disabled />
    </div>
  );
}

export const showcaseMeta = {
  title: 'MinimizeButton',
  description: 'Minimize button with ghost/outline variants and sizes (sm, md, lg). Use for minimizing windows/panels.',
  level: 'molecules',
  category: 'Action',
  group: 'Extension',
  order: 49,
};
