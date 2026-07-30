import type { ReactElement } from 'react';
import { BackButton } from './BackButton';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <BackButton />
      <BackButton showLabel />
      <BackButton showLabel label="Return" />
      <BackButton disabled />
    </div>
  );
}

export const showcaseMeta = {
  title: 'BackButton',
  group: 'Extension',
  order: 46,
};
