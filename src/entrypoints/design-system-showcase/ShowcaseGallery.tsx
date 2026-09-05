import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button, Badge, Box, Card, Heading, SearchField, Text, Tree } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import { type TreeNode } from '@/shared/ui/Tree';
import { PresetSwitcher } from '@/features/theme/ui/PresetSwitcher';
import { MockProviders } from './mockProviders';
import {
  discoverMissingShowcases,
  discoverShowcases,
  groupByLevelThenCategory,
  LIBRARY_LEVELS,
  type DiscoveredShowcase,
  type LibraryLevel,
} from './autoDiscovery';
import { ShowcaseNavigationContext } from './ShowcaseNavigationContext';
import type { PresetName } from '@/entities/theme';
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
  const [preset, setPreset] = useState<PresetName>('dawn');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-preset', preset);
  }, [mode, preset]);

  const allShowcases = useMemo(() => {
    const found = discoverShowcases();
    const missing = discoverMissingShowcases();
    return [...found, ...missing];
  }, []);

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

  const treeData: TreeNode[] = useMemo(() => {
    const grouped = groupByLevelThenCategory(filtered);
    const nodes: TreeNode[] = [];
    for (const level of LIBRARY_LEVELS) {
      if (!level.supported || level.id === 'templates') continue;
      const levelId = level.id as LibraryLevel;
      const categories = grouped[levelId] ?? {};
      const children: TreeNode[] = [];
      for (const [category, showcases] of Object.entries(categories)) {
        const items = showcases as DiscoveredShowcase[];
        children.push({
          id: `cat-${levelId}-${category}`,
          label: category,
          children: items.map((s) => ({
            id: s.id,
            label: s.meta.title,
            icon: s.missing ? 'info' : undefined,
          })),
        });
      }
      if (children.length > 0) {
        nodes.push({
          id: `level-${levelId}`,
          label: level.label,
          icon: level.icon,
          children,
        });
      }
    }
    return nodes;
  }, [filtered]);

  useEffect(() => {
    const defaults: string[] = [];
    if (treeData[0]) {
      defaults.push(treeData[0].id);
      if (treeData[0].children?.[0]) defaults.push(treeData[0].children[0].id);
      if (treeData[0].children?.[0]?.children?.[0]) defaults.push(treeData[0].children[0].children[0].id);
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
    const first = allShowcases[0];
    return first ?? null;
  }, [activeShowcaseId, byId, allShowcases]);

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
      <div className={styles.main}>
        <aside className={styles.sidebar} aria-label="Library tree">
          <div className={styles.sidebarHeader}>
            <Heading level={2} size={2} className={styles.sidebarTitle}>
              Design System
            </Heading>
            <SearchField
              value={filter}
              onChange={setFilter}
              placeholder="Search components…"
              className={styles.searchField}
            />
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
          <div className={styles.sidebarFooter}>
            <PresetSwitcher value={preset} onChange={setPreset} data-cell-id="showcase-preset-switcher" />
            <Button shape="circle"
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode((m) => (m === 'light' ? 'dark' : 'light'))}
              aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
              className={styles.themeToggle}
            >
              <Icon name={mode === 'light' ? 'moon' : 'sun'} size={18} />
            </Button>
          </div>
        </aside>

        <main className={styles.viewport}>
          {activeShowcase ? (
            <MockProviders>
              <ShowcaseNavigationContext.Provider value={{ navigateToShowcase }}>
                <Card className={styles.previewCard}>
                  <header className={styles.previewHeader}>
                    <div className={styles.previewTitleRow}>
                      <div className={styles.previewTitleWrap}>
                        <Heading level={1} size={3} className={styles.previewTitle}>
                          {activeShowcase.meta.title}
                        </Heading>
                        {activeShowcase.missing && (
                          <Badge size="sm" className={styles.statusBadge}>
                            Missing
                          </Badge>
                        )}
                        {activeShowcase.meta.status === 'deprecated' && (
                          <Badge size="sm" className={styles.statusBadgeDeprecated}>
                            Deprecated
                          </Badge>
                        )}
                        {activeShowcase.meta.status === 'experimental' && (
                          <Badge size="sm" className={styles.statusBadgeExperimental}>
                            Experimental
                          </Badge>
                        )}
                      </div>
                      <Badge size="sm" className={styles.category}>
                        {activeShowcase.meta.category}
                      </Badge>
                    </div>
                    {activeShowcase.meta.description && (
                      <Text as="p" variant="supporting" color="secondary" className={styles.previewDesc}>
                        {activeShowcase.meta.description}
                      </Text>
                    )}
                  </header>
                  <Box as="section" padding="4" className={styles.stage}>
                    <activeShowcase.Component />
                  </Box>
                </Card>
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
