import { NavItem } from './NavItem';
import { Icon } from '@/shared/icons/Icon';
import type { ReactElement } from 'react';

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <NavItem icon={<Icon name="bookOpen" size={18} />} label="Dictionary" active />
        <NavItem icon={<Icon name="settings" size={18} />} label="Settings" />
        <NavItem icon={<Icon name="video" size={18} />} label="Subtitles" disabled />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: 120,
          padding: 'var(--space-2)',
          border: 'var(--border-width-hairline) solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
        }}
      >
        <NavItem orientation="vertical" icon={<Icon name="bookOpen" size={20} />} label="Dict" active />
        <NavItem orientation="vertical" icon={<Icon name="settings" size={20} />} label="Settings" />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'NavItem',
  group: 'Shared UI — Navigation',
  order: 60,
};
