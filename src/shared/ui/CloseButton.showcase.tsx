import { CloseButton } from './CloseButton';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <CloseButton size="sm" />
        <CloseButton size="md" />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <CloseButton aria-label="Dismiss dialog" />
        <CloseButton disabled />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'CloseButton',
  description: 'Close button with ghost/solid variants and sizes (sm, md). Use for dismissing dialogs and popovers.',
  level: 'molecules',
  category: 'Action',
  group: 'Extension',
  order: 40,
};
