import { useState } from 'react';
import { Transition } from './Transition';
import { Button } from './Button';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const [visible, setVisible] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Button size="sm" onClick={() => setVisible((v) => !v)}>
        {visible ? 'Hide' : 'Show'}
      </Button>
      <Transition visible={visible}>
        <div
          style={{
            padding: 'var(--space-4)',
            background: 'var(--color-surface)',
            border: 'var(--border-width-hairline) solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          Transitioned content
        </div>
      </Transition>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Transition',
  group: 'Utility',
  order: 33,
};
