import { useState, type ReactElement } from 'react';
import { InkTabs } from './InkTabs';

export function Showcase(): ReactElement {
  const [value, setValue] = useState('preview');

  return (
    <InkTabs
      aria-label="Showcase tabs"
      items={[
        { value: 'preview', label: 'Preview', badge: 4 },
        { value: 'code', label: 'Code' },
        { value: 'settings', label: 'Settings', badge: 1 },
      ]}
      value={value}
      onValueChange={setValue}
    />
  );
}

export const showcaseMeta = {
  title: 'InkTabs',
  level: 'atoms',
  category: 'Other',
  group: 'Shared UI — Other',
  order: 53,
};
