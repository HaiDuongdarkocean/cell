import { Code } from './Code';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Code>const x = 1;</Code>
      <Code>npm run build</Code>
      <Code>Array.prototype.map()</Code>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Code',
  group: 'Display',
  order: 25,
};
