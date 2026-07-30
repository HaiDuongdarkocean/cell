import { useMemo, useState, type ChangeEvent, type ReactElement } from 'react';
import { discoverShowcases, groupShowcases } from './autoDiscovery';
import { MockProviders } from './mockProviders';
import styles from './ShowcaseGallery.module.css';

const GROUP_ORDER = [
  'Generic Core',
  'Layout',
  'Display',
  'Utility',
  'Extension',
  'Domain — Video',
  'Domain — Subtitle',
  'Domain — Dictionary',
  'Domain — Learning',
  'Shared UI',
  'Components',
];

function groupSortKey(group: string): number {
  const idx = GROUP_ORDER.indexOf(group);
  return idx === -1 ? 999 : idx;
}

export function ShowcaseGallery(): ReactElement | null {
  const [filter, setFilter] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const allShowcases = useMemo(() => discoverShowcases(), []);
  const grouped = useMemo(() => groupShowcases(allShowcases), [allShowcases]);

  const sortedGroups = useMemo(
    () => Object.entries(grouped).sort(([a], [b]) => groupSortKey(a) - groupSortKey(b)),
    [grouped],
  );

  const filteredGroups = useMemo(() => {
    if (!filter.trim()) return sortedGroups;
    const q = filter.toLowerCase();
    return sortedGroups
      .map(([group, showcases]) => [
        group,
        showcases.filter((s) => s.meta.title.toLowerCase().includes(q)),
      ] as const)
      .filter(([, showcases]) => showcases.length > 0);
  }, [sortedGroups, filter]);

  const totalCount = allShowcases.length;
  const visibleCount = filteredGroups.reduce((sum, [, showcases]) => sum + showcases.length, 0);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  };

  const handleNavClick = (group: string) => {
    setActiveGroup(group);
    const el = document.getElementById(`showcase-group-${group.replace(/[^a-zA-Z0-9]/g, '-')}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (totalCount === 0) return null;

  return (
    <div className={styles.layout}>
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Filter atoms by name..."
          value={filter}
          onChange={handleSearch}
          aria-label="Filter atoms"
        />
        <span className={styles.resultCount}>
          {visibleCount}/{totalCount} atoms
        </span>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="Group navigation">
          <nav className={styles.sidebarNav}>
            {sortedGroups.map(([group, showcases]) => {
              const isActive = activeGroup === group;
              return (
                <button
                  key={group}
                  type="button"
                  className={`${styles.sidebarLink} ${isActive ? styles.sidebarLinkActive : ''}`}
                  onClick={() => handleNavClick(group)}
                >
                  <span>{group}</span>
                  <span className={styles.sidebarCount}>{showcases.length}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className={styles.content}>
          {filteredGroups.length === 0 && (
            <div className={styles.emptyState}>No atoms match "{filter}"</div>
          )}
          {filteredGroups.map(([group, showcases]) => {
            const groupId = `showcase-group-${group.replace(/[^a-zA-Z0-9]/g, '-')}`;
            return (
              <section key={group} id={groupId} className={styles.groupSection}>
                <div className={styles.groupHeader}>
                  <h2 className={styles.groupTitle}>{group}</h2>
                  <span className={styles.groupCount}>{showcases.length} atoms</span>
                </div>
                <div className={styles.gallery}>
                  {showcases.map((showcase) => (
                    <div className={styles.card} key={showcase.id}>
                      <h3 className={styles.cardTitle}>{showcase.meta.title}</h3>
                      <div className={styles.cardBody}>
                        <MockProviders>
                          <showcase.Component />
                        </MockProviders>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
