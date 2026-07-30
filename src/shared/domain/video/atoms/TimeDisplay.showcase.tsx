import type { ReactElement } from 'react';
import { TimeDisplay } from './TimeDisplay';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <TimeDisplay currentTime={83} duration={120} format="current" />
        <span>current</span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <TimeDisplay currentTime={83} duration={120} format="remaining" />
        <span>remaining</span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <TimeDisplay currentTime={83} duration={120} format="both" />
        <span>both</span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <TimeDisplay currentTime={3661} duration={7200} format="both" />
        <span>long form</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'TimeDisplay',
  group: 'Domain — Video',
  order: 62,
};
