import { VisuallyHidden } from './VisuallyHidden';
import { Button } from './Button';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Button>Save</Button>
        <VisuallyHidden>Press to save your changes</VisuallyHidden>
      </div>
      <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)' }}>
        The text above is visually hidden but available to screen readers.
      </p>
    </div>
  );
}

export const showcaseMeta = {
  title: 'VisuallyHidden',
  level: 'atoms',
  category: 'Utility',
  group: 'Utility',
  order: 32,
};
