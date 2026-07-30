import type { ReactElement } from 'react';
import { AspectRatio } from './AspectRatio';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, maxWidth: 480 }}>
      <div style={{ width: 200 }}>
        <p style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--font-size-sm)' }}>16:9</p>
        <AspectRatio ratio={16}>
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--color-primary-subtle)',
              borderRadius: 'var(--radius-card)',
            }}
          />
        </AspectRatio>
      </div>
      <div style={{ width: 160 }}>
        <p style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--font-size-sm)' }}>1:1</p>
        <AspectRatio ratio={1}>
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--color-surface-hover)',
              borderRadius: 'var(--radius-card)',
            }}
          />
        </AspectRatio>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'AspectRatio',
  description: 'Aspect ratio container with ratio prop. Use for media with fixed proportions.',
  group: 'Layout',
  order: 16,
};
