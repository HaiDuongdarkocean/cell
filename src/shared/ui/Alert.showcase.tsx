import { useState, type ReactElement } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';

export function Showcase(): ReactElement {
  const [dismissed, setDismissed] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
      <Alert variant="default" title="Default" description="A neutral alert message." />
      <Alert variant="success" title="Success" description="Operation completed successfully." />
      <Alert variant="warning" title="Warning" description="Please review before continuing." />
      <Alert variant="error" title="Error" description="Something went wrong." />
      {!dismissed ? (
        <Alert
          variant="default"
          title="Dismissible"
          description="Click the × to dismiss."
          onDismiss={() => setDismissed(true)}
        />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setDismissed(false)}>
          Reset dismissible alert
        </Button>
      )}
    </div>
  );
}

export const showcaseMeta = {
  title: 'Alert',
  level: 'molecules',
  category: 'Feedback',
  group: 'Shared UI — Feedback',
  order: 30,
};
