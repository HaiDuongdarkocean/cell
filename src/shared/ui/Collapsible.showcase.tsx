import { useState } from 'react';
import { Collapsible } from './Collapsible';
import { Button } from './Button';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Button size="sm" onClick={() => setCollapsed((v) => !v)}>
        {collapsed ? 'Expand' : 'Collapse'}
      </Button>
      <Collapsible collapsed={collapsed}>
        <div
          style={{
            padding: 'var(--space-4)',
            background: 'var(--color-surface)',
            border: 'var(--border-width-hairline) solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          Collapsible content — expands and collapses with a smooth transition.
        </div>
      </Collapsible>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Collapsible',
  level: 'atoms',
  category: 'Utility',
  group: 'Utility',
  order: 34,
};
