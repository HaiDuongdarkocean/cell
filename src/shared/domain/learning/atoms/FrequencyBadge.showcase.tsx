import { FrequencyBadge } from './FrequencyBadge';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const levels = ['common', 'frequent', 'rare', 'academic', 'archaic'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {levels.map((level) => (
          <FrequencyBadge key={level} level={level} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <FrequencyBadge level="common">Common Word</FrequencyBadge>
        <FrequencyBadge level="archaic">Archaic Term</FrequencyBadge>
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
