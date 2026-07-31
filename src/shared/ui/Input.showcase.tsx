import { useState, type ReactElement } from 'react';
import { Input } from './Input';

export function Showcase(): ReactElement {
  const [value, setValue] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
      <Input size="sm" placeholder="Small input" value={value} onChange={(e) => setValue(e.target.value)} />
      <Input placeholder="Default input" value={value} onChange={(e) => setValue(e.target.value)} />
      <Input size="lg" placeholder="Large input" value={value} onChange={(e) => setValue(e.target.value)} />
      <Input placeholder="With error" value="invalid" error errorMessage="This value is not valid" />
      <Input placeholder="Disabled" disabled />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Input',
  description: 'Controlled text input with sizes (sm, md, lg) and error state. Use for form fields and user text entry.',
  level: 'atoms',
  category: 'Input',
  group: 'Shared UI — Input',
  order: 20,
};
