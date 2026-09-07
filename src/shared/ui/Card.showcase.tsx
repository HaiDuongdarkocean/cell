import { useState, type ReactElement } from 'react';
import { Card } from './Card';
import { Button } from './Button';

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--space-3)',
  alignItems: 'stretch',
};

const small: React.CSSProperties = { width: 'calc(var(--space-5) * 6)', padding: 'var(--space-4)' };
const medium: React.CSSProperties = { width: 'calc(var(--space-5) * 8)', padding: 'var(--space-4)' };

export function Showcase(): ReactElement {
  const [selected, setSelected] = useState(false);

  return (
    <div style={rowStyle}>
      <Card style={small}>
        <strong>Default</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>Static container.</p>
      </Card>
      <Card variant="interactive" style={small}>
        <strong>Interactive</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>Hover to see active state.</p>
      </Card>
      <Card
        variant={selected ? 'selected' : 'default'}
        onClick={() => setSelected((s) => !s)}
        style={small}
      >
        <strong>{selected ? 'Selected' : 'Selectable'}</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>Click to toggle.</p>
      </Card>
      <Card variant="interactive" style={medium}>
        <strong>Interactive Medium</strong>
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-size-sm)' }}>Solid surface on hover.</p>
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
