import { SynonymChip } from './SynonymChip';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <SynonymChip word="happy" />
        <SynonymChip word="joyful" />
        <SynonymChip word="cheerful" />
        <SynonymChip word="content" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <SynonymChip word="disabled" disabled />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'SynonymChip',
  level: 'atoms',
  category: 'Content',
  group: 'Domain — Dictionary',
  order: 87,
};
