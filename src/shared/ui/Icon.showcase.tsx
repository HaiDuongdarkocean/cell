import { Icon } from './Icon';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const sizes = ['xs', 'sm', 'md', 'lg'] as const;
  const colors = ['primary', 'secondary', 'disabled', 'inverse'] as const;
  const names = ['play', 'search', 'settings', 'check', 'info', 'x'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {names.map((name) => (
          <Icon key={name} name={name} label={name} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {sizes.map((size) => (
          <Icon key={size} name="play" size={size} label={size} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {colors.map((color) => (
          <Icon key={color} name="info" color={color} label={color} />
        ))}
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Icon',
  description: 'Icon component with sizes (xs, sm, md, lg) and semantic colors. Renders SVG icons from ICON_CATALOG.',
  group: 'Generic Core',
  order: 2,
};
