import { Heading } from './Heading';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Heading level={1}>Heading level 1</Heading>
      <Heading level={2}>Heading level 2</Heading>
      <Heading level={3}>Heading level 3</Heading>
      <Heading level={4}>Heading level 4</Heading>
      <Heading level={5}>Heading level 5</Heading>
      <Heading level={6}>Heading level 6</Heading>
      <Heading level={2} size={4}>Decoupled: h2 tag, size-4 visual</Heading>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Heading',
  description: 'Semantic heading H1-H6 with Display 1-3 variants and size decoupling. Use for page and section titles.',
  level: 'atoms',
  category: 'Content',
  group: 'Display',
  order: 20,
};
