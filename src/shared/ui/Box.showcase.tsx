import { Box } from './Box';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(['surface', 'body', 'muted', 'card', 'popover', 'transparent'] as const).map((bg) => (
          <Box key={bg} bg={bg} padding="3" radius="element" border>
            {bg}
          </Box>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(['none', 'inner', 'element', 'container', 'page', 'full'] as const).map((radius) => (
          <Box key={radius} radius={radius} padding="3" bg="muted">
            {radius}
          </Box>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(['none', 'low', 'med', 'high'] as const).map((elevation) => (
          <Box key={elevation} elevation={elevation} padding="3" radius="container" bg="surface">
            {elevation}
          </Box>
        ))}
      </div>
      <Box as="section" padding="4" border radius="container">
        Semantic section
      </Box>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Box',
  description: 'Neutral frame-first layout primitive with bg, radius, and elevation variants. Use as a container wrapper.',
  level: 'atoms',
  category: 'Layout',
  group: 'Layout',
  order: 10,
};
