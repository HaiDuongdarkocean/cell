import { StatusDot } from './StatusDot';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const statuses = ['success', 'warning', 'error', 'info', 'neutral'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {statuses.map((status) => (
          <span key={status} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <StatusDot status={status} aria-label={status} />
            <span style={{ fontSize: 'var(--font-size-sm)' }}>{status}</span>
          </span>
        ))}
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <StatusDot status="success" pulse aria-label="Live" />
        <span style={{ fontSize: 'var(--font-size-sm)' }}>pulse (live)</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'StatusDot',
  description: 'Status indicator dot with colors (success, warning, error, info, neutral) and pulse animation. Use for status indication.',
  level: 'atoms',
  category: 'Content',
  group: 'Display',
  order: 26,
};
