import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Badge, Box, Card, Heading, IconButton, SearchField, Text, Tree } from '@/shared/ui';
import { type TreeNode } from '@/shared/ui/Tree';
import { Icon } from '@/shared/icons/Icon';
import { MockProviders } from './mockProviders';
import {
  discoverShowcases,
  groupByLevelThenCategory,
  LIBRARY_LEVELS,
  type DiscoveredShowcase,
  type LibraryLevel,
} from './autoDiscovery';
import { ShowcaseNavigationContext } from './ShowcaseNavigationContext';
import styles from './ShowcaseGallery.module.css';

type ThemeMode = 'light' | 'dark';

interface ShowcasesById {
  [id: string]: DiscoveredShowcase;
}

export function ShowcaseGallery(): ReactElement | null {
  const [filter, setFilter] = useState('');
  const [activeShowcaseId, setActiveShowcaseId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'light' ? 'dark' : 'light'));
  }, []);

  const allShowcases = useMemo(() => discoverShowcases(), []);
  const byId = useMemo(() => {
    const map: ShowcasesById = {};
    for (const s of allShowcases) map[s.id] = s;
    return map;
  }, [allShowcases]);

  const navigateToShowcase = useCallback((title: string): void => {
    const match = allShowcases.find(
      (s) => s.meta.title.toLowerCase() === title.toLowerCase(),
    );
    if (match) setActiveShowcaseId(match.id);
  }, [allShowcases]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return allShowcases;
    const q = filter.toLowerCase();
    return allShowcases.filter(
      (s) =>
        s.meta.title.toLowerCase().includes(q) ||
        s.meta.description.toLowerCase().includes(q) ||
        s.meta.category.toLowerCase().includes(q) ||
        s.meta.level.includes(q),
    );
  }, [allShowcases, filter]);

  const categoryPriority: Record<string, number> = {
    Overview: 0,
    Color: 1,
    Typography: 2,
    Spacing: 3,
    Shape: 4,
    Motion: 5,
    Iconography: 6,
    Grid: 7,
  };

  const treeData: TreeNode[] = useMemo(() => {
    const grouped = groupByLevelThenCategory(filtered);
    const nodes: TreeNode[] = [];
    for (const level of LIBRARY_LEVELS) {
      if (!level.supported || level.id === 'templates') continue;
      const levelId = level.id as LibraryLevel;
      const categories = grouped[levelId] ?? {};
      const categoryEntries = Object.entries(categories).sort(([a], [b]) => {
        const pa = levelId === 'foundations' ? (categoryPriority[a] ?? 99) : 0;
        const pb = levelId === 'foundations' ? (categoryPriority[b] ?? 99) : 0;
        if (pa !== pb) return pa - pb;
        return a.localeCompare(b);
      });
      nodes.push({
        id: `level-${levelId}`,
        label: level.label,
        icon: level.icon,
        children: categoryEntries.map(([category, showcases]) => {
          const items = showcases as DiscoveredShowcase[];
          if (items.length === 1) {
            return {
              id: items[0].id,
              label: items[0].meta.title,
            };
          }
          return {
            id: `cat-${levelId}-${category}`,
            label: category,
            children: items.map((s) => ({
              id: s.id,
              label: s.meta.title,
            })),
          };
        }),
      });
    }
    return nodes;
  }, [filtered, categoryPriority]);

  useEffect(() => {
    const defaults: string[] = [];
    if (treeData[0]) {
      defaults.push(treeData[0].id);
      if (treeData[0].children?.[0]) defaults.push(treeData[0].children[0].id);
    }
    setExpandedIds((prev) => (prev.length === 0 ? defaults : prev));
  }, [treeData]);

  useEffect(() => {
    if (activeShowcaseId) return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('showcase');
    const fromPath = window.location.pathname.match(/\/showcase\/(.+)$/);
    const target = fromPath ? decodeURIComponent(fromPath[1]) : fromQuery;
    if (!target) return;
    const match = allShowcases.find(
      (s) => s.meta.title.toLowerCase() === target.toLowerCase(),
    );
    if (match) setActiveShowcaseId(match.id);
  }, [allShowcases, activeShowcaseId]);

  const activeShowcase = useMemo(() => {
    if (activeShowcaseId && byId[activeShowcaseId]) return byId[activeShowcaseId];
    return filtered[0] ?? allShowcases[0] ?? null;
  }, [activeShowcaseId, byId, filtered, allShowcases]);

  const handleSelect = useCallback((id: string, _node: TreeNode): void => {
    if (byId[id]) setActiveShowcaseId(id);
  }, [byId]);

  const handleToggle = useCallback((id: string, expanded: boolean): void => {
    setExpandedIds((prev) => {
      const set = new Set(prev);
      if (expanded) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  }, []);

  if (allShowcases.length === 0) return null;

  return (
    <div className={styles.root}>
      <div className={styles.glow} aria-hidden="true" />

      <header className={styles.topbar}>
        <Text as="span" variant="supporting" color="secondary" className={styles.eyebrow}>
          Cell Design System
        </Text>
        <SearchField
          value={filter}
          onChange={setFilter}
          placeholder="Search components…"
          className={styles.searchField}
        />
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleMode}
          aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
        >
          <Icon name={mode === 'light' ? 'moon' : 'sun'} size={20} />
        </IconButton>
      </header>

      <div className={styles.main}>
        <aside className={styles.sidebar} aria-label="Library tree">
          <div className={styles.sidebarHeader}>
            <Heading level={2} size={2} className={styles.sidebarTitle}>
              Design System
            </Heading>
            <Text color="secondary" className={styles.sidebarSubtitle}>
              Quiet confidence
            </Text>
          </div>
          <div className={styles.tree}>
            <Tree
              nodes={treeData}
              activeId={activeShowcase?.id}
              expandedIds={expandedIds}
              onSelect={handleSelect}
              onToggle={handleToggle}
              ariaLabel="Library navigation tree"
            />
          </div>
          <Card className={styles.resultCard}>
            <Text as="p" color="secondary" className={styles.resultText}>
              Showing {filtered.length} / {allShowcases.length} items
            </Text>
          </Card>
        </aside>

        <main className={styles.viewport}>
          {activeShowcase ? (
            <MockProviders>
              <ShowcaseNavigationContext.Provider value={{ navigateToShowcase }}>
                <div className={styles.previewOuter}>
                  <Card className={styles.previewInner}>
                    <div className={styles.previewHeader}>
                      <Heading level={1} size={3} className={styles.previewTitle}>
                        {activeShowcase.meta.title}
                      </Heading>
                      <Badge className={styles.category}>{activeShowcase.meta.category}</Badge>
                    </div>
                    <Text as="p" color="secondary" className={styles.previewDesc}>
                      {activeShowcase.meta.description}
                    </Text>
                    <Box className={styles.stage}>
                      <activeShowcase.Component />
                    </Box>
                  </Card>
                </div>
              </ShowcaseNavigationContext.Provider>
            </MockProviders>
          ) : (
            <div className={styles.empty}>
              <Heading level={2} size={3}>No components found</Heading>
              <Text color="secondary">Try a different search term.</Text>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
