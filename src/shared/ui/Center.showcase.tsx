import type { ReactElement } from 'react';
import { Center } from './Center';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          height: 120,
          border: 'var(--border-width-hairline) solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <Center style={{ height: '100%' }}>
          <span>Centered content</span>
        </Center>
      </div>
      <Center inline>
        <span>Inline center</span>
      </Center>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Center',
  level: 'atoms',
  category: 'Layout',
  group: 'Layout',
  order: 15,
};
