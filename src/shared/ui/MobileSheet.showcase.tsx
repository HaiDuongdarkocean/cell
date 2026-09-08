import { useState, type ReactElement } from 'react';
import { MobileSheet, type MobileSheetSnap } from './MobileSheet';
import { Button } from './Button';

/**
 * MobileSheet playground — the sheet anchors to the bottom of the relative
 * container below (same mechanics as the Universal Panel Dictionary tab).
 * Tap the pill to toggle collapsed ↔ last expanded; drag it to resize and
 * snap to the nearest point (56px / 50% / 100%).
 */
export function Showcase(): ReactElement {
  const [snap, setSnap] = useState<MobileSheetSnap>('collapsed');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" onClick={() => setSnap('half')}>Open 50%</Button>
        <Button size="sm" onClick={() => setSnap('full')}>Open 100%</Button>
        <Button size="sm" variant="ghost" onClick={() => setSnap('collapsed')}>Collapse</Button>
      </div>
      <div
        style={{
          position: 'relative',
          height: 320,
          overflow: 'hidden',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <MobileSheet
          snap={snap}
          onSnapChange={setSnap}
          header={<strong>Create card — example</strong>}
          aria-label="Card creator sheet"
        >
          <div style={{ padding: 'var(--space-4)' }}>
            Sheet content — drag the pill or tap it to toggle snap points.
          </div>
        </MobileSheet>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'MobileSheet',
  description: 'Container-anchored bottom sheet with snap points (56px / 50% / 100%), pill drag handle, tap-to-toggle.',
  level: 'molecules',
  category: 'Overlay',
  group: 'Shared UI — Overlay',
  order: 51,
};
