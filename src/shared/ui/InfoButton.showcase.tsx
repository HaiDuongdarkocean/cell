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
  group: 'Extension',
  order: 47,
};
