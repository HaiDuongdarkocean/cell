import { SourceBadge } from './SourceBadge';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const sources = ['cambridge', 'oxford', 'merriam-webster', 'collins', 'longman'] as const;
  const labels: Record<string, string> = {
    cambridge: 'Cambridge',
    oxford: 'Oxford',
    'merriam-webster': 'Merriam-Webster',
    collins: 'Collins',
    longman: 'Longman',
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {sources.map((source) => (
        <SourceBadge key={source} source={source}>{labels[source]}</SourceBadge>
      ))}
    </div>
  );
}

export const showcaseMeta = {
  title: 'SourceBadge',
  level: 'atoms',
  category: 'Content',
  group: 'Domain — Dictionary',
  order: 86,
};
