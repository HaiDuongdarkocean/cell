import { useState, type ReactElement } from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';

export function Showcase(): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Dialog</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Dialog title"
        description="A compact dialog example."
        showCloseButton
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Confirm</Button>
          </>
        }
      >
        <p>This is the dialog body content.</p>
      </Dialog>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Dialog',
  level: 'atoms',
  category: 'Overlay',
  group: 'Shared UI — Overlay',
  order: 50,
};
