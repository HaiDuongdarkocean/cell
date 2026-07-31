import { AntonymChip } from './AntonymChip';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <AntonymChip word="sad" />
        <AntonymChip word="unhappy" />
        <AntonymChip word="miserable" />
        <AntonymChip word="depressed" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <AntonymChip word="disabled" disabled />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'AntonymChip',
  level: 'atoms',
  category: 'Content',
  group: 'Domain — Dictionary',
  order: 88,
};
