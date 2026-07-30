import { useState, type ReactElement } from 'react';
import { Checkbox } from './Checkbox';

export function Showcase(): ReactElement {
  const [checked, setChecked] = useState(true);
  const [indeterminate, setIndeterminate] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Checkbox label="Default" />
      <Checkbox label="Controlled" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
      <Checkbox label="Indeterminate" indeterminate={indeterminate} onChange={(e) => setIndeterminate(e.target.checked)} />
      <Checkbox label="With error" error helperText="This field is required" />
      <Checkbox label="Disabled" disabled />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Checkbox',
  description: 'Checkbox with indeterminate state, error state, and sizes. Use for multiple selection in forms.',
  group: 'Shared UI — Input',
  order: 23,
};
