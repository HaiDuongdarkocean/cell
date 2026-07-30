import { LevelIndicator } from './LevelIndicator';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {levels.map((level) => (
          <LevelIndicator key={level} level={level} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <LevelIndicator level="B1" showLabel={false} />
        <LevelIndicator level="C1" showLabel={false} />
        <LevelIndicator level="A2">Beginner</LevelIndicator>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'LevelIndicator',
  group: 'Domain — Learning',
  order: 92,
};
