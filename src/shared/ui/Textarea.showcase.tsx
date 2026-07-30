import { useState, type ReactElement } from 'react';
import { Textarea } from './Textarea';

export function Showcase(): ReactElement {
  const [value, setValue] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
      <Textarea placeholder="Default (vertical resize)" value={value} onChange={(e) => setValue(e.target.value)} />
      <Textarea placeholder="No resize" resize="none" />
      <Textarea placeholder="With error" error />
      <Textarea placeholder="Disabled" disabled />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Textarea',
  group: 'Shared UI — Input',
  order: 25,
};
