import type { ReactElement } from 'react';
import { TimeOffset } from './TimeOffset';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span>Absolute:</span>
        <TimeOffset offset={0} />
        <TimeOffset offset={2.5} />
        <TimeOffset offset={-1.5} />
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span>Relative:</span>
        <TimeOffset offset={0} format="relative" />
        <TimeOffset offset={65} format="relative" />
        <TimeOffset offset={-90} format="relative" />
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span>No sign:</span>
        <TimeOffset offset={3.0} showSign={false} />
        <TimeOffset offset={-2.0} showSign={false} />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'TimeOffset',
  group: 'Domain — Subtitle',
  order: 73,
};
