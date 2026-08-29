import { useRef, useState, type ReactElement } from 'react';
import { Navigation } from './Navigation';
import { NavItem } from './NavItem';
import { Icon } from '@/shared/icons/Icon';

const ITEMS = [
  { id: 'all', label: 'All Items', icon: 'layers' },
  { id: 'active', label: 'Active', icon: 'play' },
  { id: 'completed', label: 'Completed', icon: 'check' },
  { id: 'settings', label: 'Settings', icon: 'slidersHorizontal' },
];

export function Showcase(): ReactElement {
  const [verticalActive, setVerticalActive] = useState('all');
  const [horizontalActive, setHorizontalActive] = useState('all');
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 1. Horizontal Navigation */}
      <div>
        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          Horizontal Navigation (Tabs / Chip-bar with sliding active indicator)
        </h3>
        <div style={{ padding: 'var(--space-2)', background: 'var(--color-surface)', border: 'var(--border-width-hairline) solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)' }}>
          <Navigation
            orientation="horizontal"
            activeId={horizontalActive}
            onActiveChange={setHorizontalActive}
            ariaLabel="Horizontal demo"
          >
            {ITEMS.map((item) => (
              <NavItem
                key={item.id}
                data-section-id={item.id}
                icon={<Icon name={item.icon as never} size={16} />}
                label={item.label}
                orientation="horizontal"
              />
            ))}
          </Navigation>
        </div>
      </div>

      {/* 2. Vertical Navigation with Scroll-spy */}
      <div>
        <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
          Vertical Navigation (Scroll-spy + rAF water-flow pill animation)
        </h3>
        <div style={{ display: 'flex', gap: 'var(--space-4)', height: 260 }}>
          <div style={{ width: 200, border: 'var(--border-width-hairline) solid var(--color-border-subtle)', borderRadius: 'var(--radius-card)', background: 'var(--color-surface)' }}>
            <Navigation
              orientation="vertical"
              activeId={verticalActive}
              onActiveChange={setVerticalActive}
              contentRef={contentRef}
              sectionRefs={sectionRefs}
              ariaLabel="Vertical scroll-spy demo"
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
          </div>
          <div
            ref={contentRef}
            style={{ flex: 1, overflow: 'auto', padding: 'var(--space-3)', border: 'var(--border-width-hairline) solid var(--color-border)', borderRadius: 'var(--radius-card)' }}
          >
            {ITEMS.map((item) => (
              <section
                key={item.id}
                data-section={item.id}
                ref={(el) => { sectionRefs.current[item.id] = el; }}
                style={{ minHeight: 120, padding: 'var(--space-3)', marginBottom: 'var(--space-3)', borderRadius: 'var(--radius-xs)', background: 'var(--color-surface-2)' }}
              >
                <h4 style={{ margin: 0, marginBottom: 'var(--space-1)' }}>{item.label}</h4>
                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Section content for {item.label}. Click the nav item or scroll to spy.
                </p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Navigation',
  description: 'Self-contained navigation organism: owns active state, floating pill rAF water-flow animation, scroll-spy, scroll-to-active, event delegation. Supports vertical & horizontal orientations.',
  level: 'organisms' as const,
  category: 'Navigation',
  order: 11,
};
