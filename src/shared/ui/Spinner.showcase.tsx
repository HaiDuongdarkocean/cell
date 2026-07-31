import type { ReactElement } from 'react';
import { Spinner } from './Spinner';

export function Showcase(): ReactElement {
  const sizes = ['sm', 'md', 'lg'] as const;
  const colors = ['primary', 'secondary', 'accent', 'on-accent', 'current'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {sizes.map((size) => (
          <Spinner key={size} size={size} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {colors.map((color) => (
          <Spinner key={color} color={color} />
        ))}
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Spinner',
  description: 'Loading spinner with sizes (2xs, xs, sm, md, lg, xl) and color variants. Use to indicate loading state.',
  level: 'atoms',
  category: 'Feedback',
  group: 'Shared UI — Feedback',
  order: 30,
};
