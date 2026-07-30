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
  description: 'Drag handle with orientation (horizontal, vertical) and sizes (sm, md, lg). Use for draggable items.',
  group: 'Extension',
  order: 43,
};
