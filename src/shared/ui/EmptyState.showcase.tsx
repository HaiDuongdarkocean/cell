import { EmptyState } from './EmptyState';
import { Button } from './Button';
import { Icon } from '@/shared/icons/Icon';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <EmptyState
        icon={<Icon name="search" size={48} />}
        title="No results"
        description="Try adjusting your search terms."
        action={<Button size="sm">Clear search</Button>}
      />
      <EmptyState
        icon={<Icon name="info" size={48} />}
        title="Nothing here yet"
        description="Add your first item to get started."
      />
    </div>
  );
}

export const showcaseMeta = {
  title: 'EmptyState',
  level: 'atoms',
  category: 'Display',
  group: 'Shared UI — Data',
  order: 42,
};
