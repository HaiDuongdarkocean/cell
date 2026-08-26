import { useState, type ReactElement } from 'react';
import { Card } from './Card';
import { Button } from './Button';

export function Showcase(): ReactElement {
  const [selected, setSelected] = useState(false);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}>
      <Card style={{ width: 120, padding: 'var(--space-4)' }}>
        <strong>Default</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>Static container.</p>
      </Card>
      <Card variant="interactive" style={{ width: 120, padding: 'var(--space-4)' }}>
        <strong>Interactive</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>Hover to see active state.</p>
      </Card>
      <Card
        variant={selected ? 'selected' : 'default'}
        onClick={() => setSelected((s) => !s)}
        style={{ width: 120, padding: 'var(--space-4)', cursor: 'pointer' }}
      >
        <strong>{selected ? 'Selected' : 'Selectable'}</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>Click to toggle.</p>
      </Card>
      <Card variant="glass" style={{ width: 160, padding: 'var(--space-4)' }}>
        <strong>Glass</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>Frosted, translucent surface.</p>
      </Card>
      <Card style={{ padding: 'var(--space-4)' }}>
        <Button size="sm">Action inside</Button>
      </Card>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Card',
  level: 'atoms',
  category: 'Display',
  group: 'Shared UI — Data',
  order: 40,
};
