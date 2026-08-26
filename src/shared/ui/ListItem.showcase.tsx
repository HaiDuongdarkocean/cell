import { type ReactElement } from 'react';
import { Badge } from './Badge';
import { Icon } from './Icon';
import { ListItem } from './ListItem';

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
  maxWidth: 'calc(var(--space-5) * 16)',
  padding: 'var(--space-3)',
  border: 'var(--border-width-hairline) solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  background: 'var(--color-surface)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  letterSpacing: 'var(--tracking-tight)',
  textTransform: 'uppercase',
};

const mutedIconStyle: React.CSSProperties = {
  color: 'var(--color-text-tertiary)',
};

export function Showcase(): ReactElement {
  return (
    <div style={rootStyle}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={labelStyle}>Plain &amp; active</div>
        <div style={listStyle}>
          <ListItem>Default row</ListItem>
          <ListItem active>Active row</ListItem>
          <ListItem>Another row</ListItem>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={labelStyle}>Leading &amp; trailing</div>
        <div style={listStyle}>
          <ListItem leading={<Icon name="search" size="sm" style={mutedIconStyle} />}>
            Search saved videos
          </ListItem>
          <ListItem
            leading={<Icon name="bookOpen" size="sm" style={mutedIconStyle} />}
            trailing={(
              <Badge size="sm" variant="outline">
                New
              </Badge>
            )}
          >
            Dictionary
          </ListItem>
          <ListItem
            leading={<Icon name="settings" size="sm" style={mutedIconStyle} />}
            trailing={<Icon name="chevronRight" size="sm" style={mutedIconStyle} />}
          >
            Settings
          </ListItem>
        </div>
      </section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'List Item',
  description: 'Row with leading and trailing content, plus an active state for selection lists.',
  level: 'molecules',
  category: 'Display',
  status: 'stable' as const,
};
