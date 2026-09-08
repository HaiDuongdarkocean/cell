import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Button, Badge, Box, Card, Heading, SearchField, Select, Text, Tree } from '@/shared/ui';
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
import {
  SHOWCASE_DATA,
  SHOWCASE_VIEWPORT,
  getViewportHeight,
} from './showcaseParams';
import type { DataVariant } from './showcaseParams';
import { type ViewportWidth, VIEWPORT_PRESETS } from './ViewportFrame';
import styles from './ShowcaseGallery.module.css';

type ThemeMode = 'light' | 'dark';

const VALID_PRESETS: PresetName[] = ['dawn', 'forest', 'ocean', 'warmth'];

interface ShowcasesById {
  [id: string]: DiscoveredShowcase;
}

function parseInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const value = new URLSearchParams(window.location.search).get('mode');
  return value === 'dark' ? 'dark' : 'light';
}

function parseInitialPreset(): PresetName {
  if (typeof window === 'undefined') return 'dawn';
  const value = new URLSearchParams(window.location.search).get('preset') as PresetName | null;
  return value && VALID_PRESETS.includes(value) ? value : 'dawn';
}

export function ShowcaseGallery(): ReactElement | null {
  const [filter, setFilter] = useState('');
  const [activeShowcaseId, setActiveShowcaseId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<ThemeMode>(parseInitialMode);
  const [preset, setPreset] = useState<PresetName>(parseInitialPreset);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-preset', preset);
    // Keep the URL in sync so a later data/viewport reload keeps the
    // chosen theme instead of snapping back to the default.
    const params = new URLSearchParams(window.location.search);
    params.set('mode', mode);
    params.set('preset', preset);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [mode, preset]);

  const currentData: DataVariant = SHOWCASE_DATA;
  const currentViewport: ViewportWidth = SHOWCASE_VIEWPORT;
  const currentViewportHeight = useMemo(
    () => getViewportHeight(currentViewport),
    [currentViewport],
  );

  const dataOptions = useMemo(
    () => [
      { value: 'full', label: 'Mock data' },
      { value: 'empty', label: 'No mock data' },
      { value: 'overflow', label: 'Overflow' },
    ],
    [],
  );

  const viewportOptions = useMemo(
    () => VIEWPORT_PRESETS.map((p) => ({ value: String(p.value), label: p.label })),
    [],
  );

  const applyData = useCallback((next: DataVariant) => {
    const params = new URLSearchParams(window.location.search);
    params.set('data', next);
    window.location.href = `${window.location.pathname}?${params.toString()}`;
  }, []);

  const applyViewport = useCallback((next: ViewportWidth) => {
    const params = new URLSearchParams(window.location.search);
    params.set('viewport', String(next));
    window.location.href = `${window.location.pathname}?${params.toString()}`;
  }, []);

  const stageStyle = useMemo(() => {
    if (currentViewport === 'full') {
      return { width: '100%' as const, height: '100%' as const };
    }
    return {
      width: `${currentViewport}px`,
      height: currentViewportHeight ? `${currentViewportHeight}px` : '100%',
    };
  }, [currentViewport, currentViewportHeight]);

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
          <div className={styles.sidebarControls}>
            <Select
              value={currentData}
              options={dataOptions}
              onChange={(value) => applyData(value as DataVariant)}
              aria-label="Mock data mode"
              data-cell-id="showcase-data-select"
              size="sm"
            />
            <Select
              value={String(currentViewport)}
              options={viewportOptions}
              onChange={(value) => applyViewport(value as ViewportWidth)}
              aria-label="Preview viewport"
              data-cell-id="showcase-viewport-select"
              size="sm"
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
                    <div
                      className={styles.stageViewport}
                      style={stageStyle}
                      data-cell-id="showcase-stage-viewport"
                    >
                      <activeShowcase.Component />
                    </div>
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
