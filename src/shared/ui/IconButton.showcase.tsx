import { Icon } from '@/shared/icons/Icon';
import { IconButton } from './IconButton';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <IconButton size="xs" aria-label="Extra small">
        <Icon name="settings" size={14} />
      </IconButton>
      <IconButton size="sm" aria-label="Small">
        <Icon name="settings" size={18} />
      </IconButton>
      <IconButton size="md" aria-label="Medium">
        <Icon name="settings" size={20} />
      </IconButton>
      <IconButton active aria-label="Active">
        <Icon name="settings" size={20} />
      </IconButton>
      <IconButton variant="danger" aria-label="Danger">
        <Icon name="trash" size={20} />
      </IconButton>
      <IconButton variant="danger" active aria-label="Danger active">
        <Icon name="trash" size={20} />
      </IconButton>
    </div>
  );
}

export const showcaseMeta = {
  title: 'IconButton',
  group: 'Shared UI — Action',
  order: 11,
};
