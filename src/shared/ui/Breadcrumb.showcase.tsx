import { type ReactElement } from 'react';
import { Breadcrumb } from './Breadcrumb';

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-6)',
};

const panelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--space-3) var(--space-4)',
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

const defaultItems = [
  { label: 'Home', id: 'home' },
  { label: 'Library', id: 'library' },
  { label: 'Saved videos', id: 'saved' },
  { label: 'Lesson 1', id: 'lesson' },
];

const explicitCurrentItems = [
  { label: 'Home', id: 'home' },
  { label: 'Settings', id: 'settings', current: true },
];

export function Showcase(): ReactElement {
  return (
    <div style={rootStyle}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={labelStyle}>Default path</div>
        <div style={panelStyle}>
          <Breadcrumb items={defaultItems} ariaLabel="Saved video path" />
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={labelStyle}>Explicit current</div>
        <div style={panelStyle}>
          <Breadcrumb items={explicitCurrentItems} ariaLabel="Settings path" />
        </div>
      </section>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Breadcrumb',
  description: 'Path navigation with slash separators and automatic or explicit current-page marking.',
  level: 'molecules',
  category: 'Navigation',
  status: 'stable' as const,
};
