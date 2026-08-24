import type { ReactElement } from 'react';

/**
 * SettingsDialogLayout — Template (Atomic Design level 4).
 *
 * Template = page layout skeleton with placeholder content.
 * Demonstrates the structural composition: sidebar + main column + header.
 * No real data — just wireframe blocks showing how organisms compose into a page structure.
 */
export function Showcase(): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-secondary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        Template: sidebar + main column layout skeleton (no real content)
      </div>

      {/* Wireframe frame */}
      <div
        style={{
          display: 'flex',
          height: 400,
          border: 'var(--border-width-hairline) solid var(--color-border)',
          borderRadius: 'var(--radius-card)',
          overflow: 'hidden',
          background: 'var(--color-surface-1)',
        }}
      >
        {/* Sidebar skeleton */}
        <div
          style={{
            width: 200,
            borderRight: 'var(--border-width-hairline) solid var(--color-border)',
            padding: 'var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            background: 'var(--color-surface-2)',
          }}
        >
          {/* Header placeholder */}
          <div style={{ height: 24, borderRadius: 'var(--radius-xs)', background: 'var(--color-surface-3)', opacity: 0.5 }} />
          {/* Nav item placeholders */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-xs)',
                background: i === 0 ? 'var(--color-surface-3)' : 'transparent',
                opacity: i === 0 ? 0.7 : 0.4,
              }}
            >
              <div style={{ width: 18, height: 18, borderRadius: 'var(--radius-full)', background: 'var(--color-surface-3)' }} />
              <div style={{ flex: 1, height: 12, borderRadius: 'var(--radius-xs)', background: 'var(--color-surface-3)' }} />
            </div>
          ))}
        </div>

        {/* Main column skeleton */}
        <div
          style={{
            flex: 1,
            padding: 'var(--space-4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            overflow: 'hidden',
          }}
        >
          {/* Section header placeholder */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ width: 180, height: 20, borderRadius: 'var(--radius-xs)', background: 'var(--color-surface-3)', opacity: 0.6 }} />
            <div style={{ width: 280, height: 14, borderRadius: 'var(--radius-xs)', background: 'var(--color-surface-3)', opacity: 0.3 }} />
          </div>
          {/* Card placeholders */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                padding: 'var(--space-4)',
                border: 'var(--border-width-hairline) solid var(--color-border)',
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ width: 140, height: 16, borderRadius: 'var(--radius-xs)', background: 'var(--color-surface-3)', opacity: 0.5 }} />
              <div style={{ width: '100%', height: 12, borderRadius: 'var(--radius-xs)', background: 'var(--color-surface-3)', opacity: 0.3 }} />
              <div style={{ width: '60%', height: 12, borderRadius: 'var(--radius-xs)', background: 'var(--color-surface-3)', opacity: 0.3 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Annotation */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)',
        }}
      >
        <span>Sidebar organism → 200px fixed width</span>
        <span>·</span>
        <span>Main column → flex:1, scrollable</span>
        <span>·</span>
        <span>Header → optional, collapsible</span>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Settings Dialog Layout',
  description: 'Template (Atomic Design level 4): sidebar + main column layout skeleton. Wireframe showing how Sidebar organism composes with content area into a full page structure. No real data — placeholder blocks only.',
  level: 'templates' as const,
  category: 'Layout',
  order: 10,
};
