import type { ReactElement } from 'react';
import { InfoButton } from './InfoButton';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <InfoButton />
      <InfoButton ariaLabel="Show details" />
      <InfoButton disabled />
    </div>
  );
}

export const showcaseMeta = {
  title: 'InfoButton',
  description: 'Info button with ghost/outline variants and sizes (sm, md, lg). Use for showing help/info.',
  level: 'atoms',
  category: 'Action',
  group: 'Extension',
  order: 47,
};
