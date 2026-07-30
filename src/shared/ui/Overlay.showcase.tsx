import { useState, type ReactElement } from 'react';
import { Overlay } from './Overlay';
import { Button } from './Button';

export function Showcase(): ReactElement {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <Button size="sm" onClick={() => setVisible(true)}>
        Show overlay
      </Button>
      {visible && (
        <Overlay onClick={() => setVisible(false)}>
          <div
            style={{
              padding: 'var(--space-6)',
              background: 'var(--color-background)',
              color: 'var(--color-text)',
              borderRadius: 'var(--radius-dialog)',
            }}
          >
            <p style={{ margin: 0 }}>Click outside to close</p>
          </div>
        </Overlay>
      )}
    </div>
  );
}

export const showcaseMeta = {
  title: 'Overlay',
  description: 'Modal overlay with elevation, blur, and enter/exit animations. Use as backdrop for modals and popovers.',
  group: 'Layout',
  order: 18,
};
