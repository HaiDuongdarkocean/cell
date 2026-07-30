import type { ReactElement } from 'react';
import { SkipButton } from './SkipButton';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <SkipButton direction="backward" seconds={10} />
        <SkipButton direction="forward" seconds={10} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <SkipButton direction="backward" seconds={5} />
        <SkipButton direction="forward" seconds={15} />
        <SkipButton disabled direction="forward" seconds={10} />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'SkipButton',
  group: 'Domain — Video',
  order: 68,
};
