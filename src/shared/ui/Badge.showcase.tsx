import { Badge } from './Badge';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const variants = ['default', 'secondary', 'outline', 'destructive', 'success', 'warning'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {variants.map((variant) => (
          <Badge key={variant} variant={variant}>{variant}</Badge>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Badge size="sm">Small</Badge>
        <Badge size="md">Medium</Badge>
        <Badge max={99}>{120}</Badge>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Badge',
  group: 'Shared UI — Feedback',
  order: 31,
};
