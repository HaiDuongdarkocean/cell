import { type ReactElement } from 'react';
import { Button } from './Button';
import { Header } from './Header';
import { Icon } from './Icon';

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
};

const panelStyle: React.CSSProperties = {
  border: 'var(--border-width-hairline) solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  overflow: 'hidden',
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
        <div style={labelStyle}>Title only</div>
        <div style={panelStyle}>
          <Header title="Popup title" />
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={labelStyle}>With leading &amp; trailing</div>
        <div style={panelStyle}>
          <Header
            title="Video details"
            leading={(
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<Icon name="chevronLeft" size="sm" style={mutedIconStyle} />}
              >
                Back
              </Button>
            )}
            trailing={(
              <>
                <Button size="sm" variant="outline">
                  Edit
                </Button>
                <Button size="sm" variant="primary">
                  Save
                </Button>
              </>
            )}
          />
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={labelStyle}>Title as children</div>
        <div style={panelStyle}>
          <Header leading={<Icon name="menu" size="sm" style={mutedIconStyle} />}>
            Settings
          </Header>
        </div>
      </section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Header',
  description: 'Top chrome with title and leading / trailing actions for panels and popups.',
  level: 'organisms',
  category: 'Display',
  status: 'stable' as const,
};
