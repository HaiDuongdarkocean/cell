import { Skeleton } from './Skeleton';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton shape="circle" width={40} height={40} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={14} />
        </div>
      </div>
      <Skeleton width="100%" height={80} shape="rounded" />
      <div style={{ display: 'flex', gap: 8 }}>
        <Skeleton width={80} height={32} />
        <Skeleton width={120} height={32} />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Skeleton',
  level: 'atoms',
  category: 'Display',
  group: 'Shared UI — Data',
  order: 41,
};
