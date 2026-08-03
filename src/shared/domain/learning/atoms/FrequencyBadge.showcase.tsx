import { FrequencyBadge } from './FrequencyBadge';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const levels = ['core', 'common', 'general', 'advanced', 'rare'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {levels.map((level) => (
          <FrequencyBadge key={level} level={level} source="COCA" rank={1234} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <FrequencyBadge level="common">Common Word</FrequencyBadge>
        <FrequencyBadge level="rare">Rare Term</FrequencyBadge>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'FrequencyBadge',
  level: 'atoms',
  category: 'Feedback',
  group: 'Domain — Learning',
  order: 91,
};
