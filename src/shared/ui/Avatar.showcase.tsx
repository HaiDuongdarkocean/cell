import { Avatar } from './Avatar';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const sizes = ['xs', 'sm', 'md', 'lg'] as const;
  const statuses = ['online', 'offline', 'busy', 'none'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {sizes.map((size) => (
          <Avatar key={size} alt="Jo" size={size} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Avatar alt="Circle" shape="circle" />
        <Avatar alt="Square" shape="square" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {statuses.map((status) => (
          <Avatar key={status} alt="St" status={status} />
        ))}
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Avatar',
  description: 'User avatar with sizes (xs, sm, md, lg), shapes (circle, square), status dot, and fallback. Use for user representation.',
  group: 'Generic Core',
  order: 3,
};
