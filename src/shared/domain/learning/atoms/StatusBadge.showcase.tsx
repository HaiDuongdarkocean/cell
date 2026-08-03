import { StatusBadge } from './StatusBadge';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const statuses = ['unknown', 'tracking', 'known', 'ignore'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {statuses.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <StatusBadge status="known">Custom Label</StatusBadge>
        <StatusBadge status="tracking">In Progress</StatusBadge>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'StatusBadge',
  level: 'atoms',
  category: 'Feedback',
  group: 'Domain — Learning',
  order: 92,
};
