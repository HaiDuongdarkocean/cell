import { useRef, useState, type ReactElement } from 'react';
import { Sidebar } from './Sidebar';
import { Navigation } from './Navigation';
import { NavItem } from './NavItem';
import { Icon } from '@/shared/icons/Icon';

const ITEMS = [
  { id: 'media', label: 'Media', icon: 'video' },
  { id: 'block', label: 'Block', icon: 'captions' },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'slidersHorizontal' },
  { id: 'download', label: 'Download', icon: 'download' },
  { id: 'theme', label: 'Theme', icon: 'sun' },
  { id: 'resources', label: 'Resources', icon: 'library' },
];

function SidebarDemo({ collapsible }: { collapsible?: boolean }): ReactElement {
  const [activeId, setActiveId] = useState('media');
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)', height: 360 }}>
      <Sidebar
        ariaLabel="Demo sections"
        collapsible={collapsible}
        header="Settings"
      >
        <Navigation
          activeId={activeId}
          onActiveChange={setActiveId}
          contentRef={contentRef}
          sectionRefs={sectionRefs}
        >
          {ITEMS.map((item) => (
            <NavItem
              key={item.id}
              data-section-id={item.id}
              icon={<Icon name={item.icon as never} size={18} />}
              label={item.label}
              orientation="horizontal"
            />
          ))}
        </Navigation>
      </Sidebar>
      <div
        ref={contentRef}
        style={{ flex: 1, overflow: 'auto', padding: 'var(--space-4)', border: 'var(--border-width-hairline) solid var(--color-border)', borderRadius: 'var(--radius-card)' }}
      >
        {ITEMS.map((item) => (
          <section
            key={item.id}
            data-section={item.id}
            ref={(el) => { sectionRefs.current[item.id] = el; }}
            style={{ minHeight: 200, padding: 'var(--space-3)', marginBottom: 'var(--space-3)', borderRadius: 'var(--radius-xs)', background: 'var(--color-surface-2)' }}
          >
            <h3 style={{ margin: 0, marginBottom: 'var(--space-2)' }}>{item.label}</h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Scroll to see the floating active background slide between nav items.
              The active indicator syncs with content position via scroll-spy.
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}

function SidebarCustomContentDemo(): ReactElement {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)', height: 260 }}>
      <Sidebar header="Filters & Actions" collapsible>
        <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Custom Body Slot</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--font-size-sm)' }}>
            <input type="checkbox" defaultChecked /> Auto-refresh
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--font-size-sm)' }}>
            <input type="checkbox" /> High priority
          </label>
          <button type="button" style={{ marginTop: 'var(--space-2)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-xs)' }}>
            Apply Filter
          </button>
        </div>
      </Sidebar>
      <div style={{ flex: 1, padding: 'var(--space-4)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-card)' }}>
        <p>Sidebar co giãn tự nhiên theo custom content bên trong mà không phụ thuộc vào menu navigation.</p>
      </div>
    </div>
  );
}

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          Sidebar as Shell (wrapping Navigation with scroll-spy)
        </h3>
        <SidebarDemo collapsible />
      </div>
      <div>
        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          Sidebar with Custom Body Content (Form / Filters)
        </h3>
        <SidebarCustomContentDemo />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Sidebar',
  description: 'Responsive layout shell container (container > header + body). Co giãn theo content bên trong, quản lý collapsible + toggle.',
  level: 'templates' as const,
  category: 'Layout',
  order: 10,
};
