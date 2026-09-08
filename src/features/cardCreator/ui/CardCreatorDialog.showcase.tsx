import { CardCreatorDialogContent } from './CardCreatorDialogContent';
import { useMockCardCreator } from '@/entrypoints/design-system-showcase/mockProviders';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  const state = useMockCardCreator();

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 560,
        border: 'var(--border-width-hairline) solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        overflow: 'auto',
        background: 'var(--color-surface-card)',
      }}
    >
      <CardCreatorDialogContent state={state} variant="desktop" layout="panel" />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Card Creator',
  level: 'organisms',
  category: 'Display',
  group: 'Features',
  order: 104,
};
