import { Thumbnail } from './Thumbnail';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
      <Thumbnail src="https://placehold.co/120" alt="1:1" ratio="1:1" style={{ width: 120 }} />
      <Thumbnail src="https://placehold.co/160x120" alt="4:3" ratio="4:3" style={{ width: 160 }} />
      <Thumbnail src="https://placehold.co/192x108" alt="16:9" ratio="16:9" style={{ width: 192 }} />
      <Thumbnail src="/broken.jpg" alt="Fallback" fallbackSrc="https://placehold.co/120" ratio="1:1" style={{ width: 120 }} />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Thumbnail',
  group: 'Display',
  order: 21,
};
