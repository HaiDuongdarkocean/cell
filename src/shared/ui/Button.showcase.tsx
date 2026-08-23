import { Button } from './Button';
import { Icon } from '@/shared/icons/Icon';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Variants — horizontal</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="primarySubtle">Primary Subtle</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Active state — toggle</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Button variant="outline">Inactive</Button>
          <Button variant="outline" active>Active</Button>
          <Button variant="ghost">Ghost inactive</Button>
          <Button variant="ghost" active>Ghost active</Button>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Sizes</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Button size="sm" variant="primary">Small</Button>
          <Button size="md" variant="primary">Medium</Button>
          <Button size="lg" variant="primary">Large</Button>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>Orientation: vertical (ZaloPay pattern)</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', maxWidth: 400 }}>
          <Button variant="ghost" orientation="vertical" fullWidth leadingIcon={<Icon name="search" size={20} />}>Search</Button>
          <Button variant="ghost" orientation="vertical" fullWidth active leadingIcon={<Icon name="eyeOff" size={20} />}>Hide</Button>
          <Button variant="primarySubtle" orientation="vertical" fullWidth leadingIcon={<Icon name="generateNative" size={20} />}>Generate</Button>
          <Button variant="ghost" orientation="vertical" fullWidth leadingIcon={<Icon name="slidersHorizontal" size={20} />}>Customize</Button>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 12, color: '#737373', marginBottom: 8 }}>States</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
          <Button fullWidth>Full width</Button>
          <Button elevation="med">Elevated</Button>
        </div>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Button',
  description: 'Button atom — 7 variants (primary, primarySubtle, secondary, outline, ghost, destructive, link), 2 orientations (horizontal, vertical), 3 sizes, active toggle state. Token-driven, theme-agnostic.',
  level: 'atoms',
  category: 'Action',
  group: 'Shared UI — Action',
  order: 10,
};
