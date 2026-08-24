import { useRef, useState, type ReactElement } from 'react';
import { Sidebar } from './Sidebar';
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

export function Showcase(): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div>
        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          Collapsible sidebar with scroll-spy + floating active indicator
        </h3>
        <SidebarDemo collapsible />
      </div>
      <div>
        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          Non-collapsible sidebar
        </h3>
        <SidebarDemo />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Sidebar',
  description: 'Self-contained navigation organism: owns active state, floating bg rAF animation (ease-in-out cubic, water-flow), IntersectionObserver scroll-spy, scroll-to-active, collapse morph. Consumer chỉ truyền activeId + contentRef + sectionRefs. Event delegation — NavItem children không cần onClick/active/aria-current.',
  level: 'organisms' as const,
  category: 'Navigation',
  order: 10,
};
