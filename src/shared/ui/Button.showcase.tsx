import { Button } from './Button';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
      <Button size="sm" variant="primary">Small</Button>
      <Button size="lg" variant="primary">Large</Button>
      <Button disabled>Disabled</Button>
      <Button loading>Loading</Button>
      <Button fullWidth>Full width</Button>
      <Button elevation="med">Elevated</Button>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Button',
  description: 'Interactive button with variants (primary, secondary, outline, ghost, destructive, link) and sizes (sm, md, lg). Use for user actions and form submissions.',
  level: 'molecules',
  category: 'Action',
  group: 'Shared UI — Action',
  order: 10,
};
