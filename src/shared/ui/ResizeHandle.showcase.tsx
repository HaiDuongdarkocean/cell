import { ResizeHandle } from './ResizeHandle';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', height: 80, alignItems: 'stretch' }}>
        <div style={{ flex: 1, background: 'var(--color-surface)' }} />
        <ResizeHandle direction="horizontal" />
        <div style={{ flex: 1, background: 'var(--color-surface-hover)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 40, background: 'var(--color-surface)' }} />
        <ResizeHandle direction="vertical" />
        <div style={{ height: 40, background: 'var(--color-surface-hover)' }} />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'ResizeHandle',
  description: 'Resize handle with horizontal/vertical directions and sizes (sm, md). Use for resizable panels.',
  group: 'Extension',
  order: 44,
};
