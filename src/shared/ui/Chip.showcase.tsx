import { Chip } from './Chip';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Chip>Default</Chip>
        <Chip variant="outline">Outline</Chip>
        <Chip as="button">Button</Chip>
        <Chip as="button" selected>Selected</Chip>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Chip size="sm">Small</Chip>
        <Chip size="md">Medium</Chip>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Chip',
  description: 'Removable chip with default/outline variants, selected state, and sizes (sm, md). Use for tags and filters.',
  group: 'Extension',
  order: 41,
};
