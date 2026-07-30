import { CopyButton } from './CopyButton';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <CopyButton value="https://example.com" />
        <CopyButton value="https://example.com" label="Copy link" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <CopyButton value="const x = 42;" label="Copy code" />
        <CopyButton value="disabled" label="Disabled" disabled />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'CopyButton',
  group: 'Extension',
  order: 42,
};
