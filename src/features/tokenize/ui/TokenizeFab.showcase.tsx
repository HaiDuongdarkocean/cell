import { TokenizeFab } from './TokenizeFab';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ position: 'relative', height: 80, width: '100%' }}>
      <TokenizeFab onOpenDictionary={() => {}} />
    </div>
  );
}

export const showcaseMeta = {
  title: 'TokenizeFab',
  level: 'molecules',
  category: 'Display',
  group: 'Features',
  order: 102,
};
