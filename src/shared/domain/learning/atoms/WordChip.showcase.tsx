import { WordChip } from './WordChip';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const statuses = ['new', 'learning', 'mastered', 'unknown'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {statuses.map((status) => (
          <WordChip key={status} word={status} status={status} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <WordChip word="ephemeral" status="new" />
        <WordChip word="serendipity" status="learning" />
        <WordChip word="ubiquitous" status="mastered" />
        <WordChip word="discombobulate" status="unknown" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <WordChip word="disabled" status="learning" disabled />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'WordChip',
  level: 'atoms',
  category: 'Feedback',
  group: 'Domain — Learning',
  order: 90,
};
