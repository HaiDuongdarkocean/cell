import { useState, type ReactElement } from 'react';
import { Button } from './Button';
import { SelectionBar } from './SelectionBar';
import { Text } from './Text';

export function Showcase(): ReactElement {
  const [open, setOpen] = useState(true);
  const [openWithLabel, setOpenWithLabel] = useState(true);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          Toggle bar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpenWithLabel((v) => !v)}>
          Toggle labeled bar
        </Button>
      </div>
      <div style={{ minHeight: 200, border: '1px dashed var(--color-divider)', padding: 12, overflow: 'auto' }}>
        <SelectionBar open={open} data-cell-id="showcase-selection-bar">
          <Button variant="secondary">Change status</Button>
          <Button variant="errorSubtle">Delete</Button>
        </SelectionBar>
      </div>
      <div style={{ minHeight: 200, border: '1px dashed var(--color-divider)', padding: 12, overflow: 'auto' }}>
        <SelectionBar
          open={openWithLabel}
          label={<Text color="secondary">3 selected</Text>}
          data-cell-id="showcase-selection-bar-labeled"
        >
          <Button variant="destructive" size="sm">Delete</Button>
          <Button variant="ghost" size="sm">Cancel</Button>
        </SelectionBar>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'SelectionBar',
  description:
    'Sticky bottom toolbar for multi-select flows — elevated surface, optional leading count label, equal-width actions, enter/exit motion.',
  level: 'molecules',
  category: 'Action',
  group: 'Extension',
};
