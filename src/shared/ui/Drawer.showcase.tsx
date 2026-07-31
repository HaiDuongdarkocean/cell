import { useState, type ReactElement } from 'react';
import { Drawer } from './Drawer';
import { Button } from './Button';

export function Showcase(): ReactElement {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('right');

  const openFrom = (s: 'left' | 'right'): void => {
    setSide(s);
    setOpen(true);
  };

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Button onClick={() => openFrom('left')}>Left Drawer</Button>
      <Button variant="secondary" onClick={() => openFrom('right')}>Right Drawer</Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Drawer title"
        side={side}
        footer={<Button onClick={() => setOpen(false)}>Close</Button>}
      >
        <p>Drawer content slides in from the {side}.</p>
      </Drawer>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Drawer',
  level: 'atoms',
  category: 'Overlay',
  group: 'Shared UI — Overlay',
  order: 51,
};
