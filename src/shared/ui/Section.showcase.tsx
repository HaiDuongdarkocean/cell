import type { ReactElement } from 'react';
import { Section } from './Section';

export function Showcase(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        border: 'var(--border-width-hairline) solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
      }}
    >
      <Section padding="4">
        <strong>Small section</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>
          padding-block: var(--space-4)
        </p>
      </Section>
      <Section padding="6">
        <strong>Medium section (default)</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>
          padding-block: var(--space-6)
        </p>
      </Section>
      <Section padding="10">
        <strong>Large section</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>
          padding-block: var(--space-10)
        </p>
      </Section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Section',
  description: 'Semantic section wrapper with as prop (section, article, main, etc.), padding, and gap. Use for content sectioning.',
  level: 'atoms',
  category: 'Layout',
  group: 'Layout',
  order: 17,
};
