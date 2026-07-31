import { Tooltip } from './Tooltip';
import { Button } from './Button';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', padding: 'var(--space-4) 0' }}>
      <Tooltip content="Top tooltip" placement="top">
        <Button size="sm" variant="outline">Top</Button>
      </Tooltip>
      <Tooltip content="Bottom tooltip" placement="bottom">
        <Button size="sm" variant="outline">Bottom</Button>
      </Tooltip>
      <Tooltip content="Left tooltip" placement="left">
        <Button size="sm" variant="outline">Left</Button>
      </Tooltip>
      <Tooltip content="Right tooltip" placement="right">
        <Button size="sm" variant="outline">Right</Button>
      </Tooltip>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Tooltip',
  level: 'atoms',
  category: 'Overlay',
  group: 'Shared UI — Overlay',
  order: 53,
};
