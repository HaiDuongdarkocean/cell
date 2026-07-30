import { useState, type ReactElement } from 'react';
import { Radio } from './Radio';

export function Showcase(): ReactElement {
  const [value, setValue] = useState('a');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Radio label="Option A" name="group" value="a" checked={value === 'a'} onChange={() => setValue('a')} />
      <Radio label="Option B" name="group" value="b" checked={value === 'b'} onChange={() => setValue('b')} />
      <Radio label="Option C" name="group" value="c" checked={value === 'c'} onChange={() => setValue('c')} />
      <Radio label="With error" name="group2" error helperText="Pick one" />
      <Radio label="Disabled" name="group3" disabled />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Radio',
  group: 'Shared UI — Input',
  order: 24,
};
