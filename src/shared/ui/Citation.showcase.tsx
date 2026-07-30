import { Citation } from './Citation';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Citation>Plain citation</Citation>
      <Citation href="https://example.com">Linked citation</Citation>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Citation',
  group: 'Display',
  order: 24,
};
