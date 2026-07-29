import { useState, type ReactElement } from 'react';
import { Select } from './Select';

const OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh', label: '中文', disabled: true },
  { value: 'ja', label: '日本語' },
];

export function Showcase(): ReactElement {
  const [value, setValue] = useState('en');
  const [value2, setValue2] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 320 }}>
      <Select options={OPTIONS} value={value} onChange={setValue} placeholder="Choose a language" />
      <Select options={OPTIONS} value={value2} onChange={setValue2} error placeholder="Select with error" />
      <Select options={OPTIONS} value="" onChange={() => {}} disabled placeholder="Disabled select" />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Select',
  group: 'Shared UI — Input',
  order: 21,
};
