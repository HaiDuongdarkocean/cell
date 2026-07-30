import { DragHandle } from './DragHandle';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <DragHandle />
        <DragHandle aria-label="Drag item" />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'DragHandle',
  group: 'Extension',
  order: 43,
};
