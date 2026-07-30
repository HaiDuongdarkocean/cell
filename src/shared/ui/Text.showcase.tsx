import { Text } from './Text';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const variants = ['body', 'label', 'heading-1', 'heading-2', 'heading-3', 'supporting'] as const;
  const colors = ['primary', 'secondary', 'disabled', 'inverse'] as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {variants.map((variant) => (
          <Text key={variant} variant={variant}>{variant}</Text>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        {colors.map((color) => (
          <Text key={color} color={color}>{color}</Text>
        ))}
      </div>
      <div style={{ maxWidth: 120 }}>
        <Text truncate>Truncated long text that overflows</Text>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Text',
  group: 'Generic Core',
  order: 1,
};
