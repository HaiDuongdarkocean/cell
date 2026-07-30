import { PhoneticText } from './PhoneticText';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PhoneticText>/həˈloʊ/</PhoneticText>
      <PhoneticText>/ˌserənˈdɪpəti/</PhoneticText>
      <PhoneticText>/ɪˈfem(ə)rəl/</PhoneticText>
    </div>
  );
}

export const showcaseMeta = {
  title: 'PhoneticText',
  group: 'Domain — Dictionary',
  order: 81,
};
