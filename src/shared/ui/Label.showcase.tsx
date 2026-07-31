import type { ReactElement } from 'react';
import { Label } from './Label';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Label size="sm" htmlFor="a">Small label</Label>
      <Label size="md" htmlFor="b">Medium label</Label>
      <Label size="lg" htmlFor="c">Large label</Label>
      <Label required htmlFor="d">Required field</Label>
      <Label disabled htmlFor="e">Disabled label</Label>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Label',
  description: 'Form label with required indicator and sizes (sm, md, lg). Use to label form controls.',
  level: 'atoms',
  category: 'Input',
  group: 'Shared UI — Input',
  order: 21,
};
