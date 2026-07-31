import { Link } from './Link';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const variants = ['inline', 'standalone', 'destructive'] as const;
  const sizes = ['sm', 'md', 'lg'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {variants.map((variant) => (
          <Link key={variant} href="#" variant={variant}>{variant}</Link>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {sizes.map((size) => (
          <Link key={size} href="#" size={size}>{size}</Link>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Link href="https://example.com" external>External link</Link>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Link',
  description: 'Hyperlink with variants (inline, standalone, destructive) and external icon. Use for navigation links.',
  level: 'atoms',
  category: 'Content',
  group: 'Generic Core',
  order: 5,
};
