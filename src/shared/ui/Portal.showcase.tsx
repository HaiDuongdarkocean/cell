import { useState } from 'react';
import { Portal } from './Portal';
import { Button } from './Button';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Button size="sm" onClick={() => setOpen((v) => !v)}>
        {open ? 'Close portal' : 'Open portal'}
      </Button>
      {open && (
        <Portal>
          <div
            style={{
              padding: 'var(--space-4)',
              background: 'var(--color-surface)',
              border: 'var(--border-width-hairline) solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            Portaled content (rendered into document.body)
          </div>
        </Portal>
      )}
    </div>
  );
}

export const showcaseMeta = {
  title: 'Portal',
  group: 'Utility',
  order: 31,
};
