import { Separator } from './Separator';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span>Horizontal solid</span>
        <Separator orientation="horizontal" variant="solid" />
        <span>Horizontal dashed</span>
        <Separator orientation="horizontal" variant="dashed" />
      </div>
      <div style={{ display: 'flex', gap: 16, height: 60, alignItems: 'center' }}>
        <span>Vertical</span>
        <Separator orientation="vertical" variant="solid" />
        <Separator orientation="vertical" variant="dashed" />
        <span>End</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Separator',
  group: 'Generic Core',
  order: 4,
};
