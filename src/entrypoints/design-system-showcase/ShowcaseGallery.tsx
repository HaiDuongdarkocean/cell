import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  Breadcrumb,
  Button,
  Card,
  Code,
  Heading,
  IconButton,
  SearchField,
  Tabs,
  Text,
  Tree,
} from '@/shared/ui';
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
import styles from './ShowcaseGallery.module.css';

type ThemeMode = 'light' | 'dark';

const DEFAULT_TABS = ['overview', 'tokens', 'usage', 'code'] as const;
type DetailTab = (typeof DEFAULT_TABS)[number];

interface ShowcasesById {
  [id: string]: DiscoveredShowcase;
}

export function ShowcaseGallery(): ReactElement | null {
  const [filter, setFilter] = useState('');
  const [activeShowcaseId, setActiveShowcaseId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
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
          // Flatten single-child categories: click goes straight to the showcase.
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

  // Default expansion: first level and first category.
  useEffect(() => {
    const defaults: string[] = [];
    if (treeData[0]) {
      defaults.push(treeData[0].id);
      if (treeData[0].children?.[0]) defaults.push(treeData[0].children[0].id);
    }
    setExpandedIds((prev) => (prev.length === 0 ? defaults : prev));
  }, [treeData]);

  // Auto-open from URL param: ?showcase=Title or /showcase/Title
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

  const handleSelect = useCallback((id: string, node: TreeNode): void => {
    if (byId[id]) {
      setActiveShowcaseId(id);
      setActiveTab('overview');
      return;
    }
    // Clicking a level/category branch selects the first descendant showcase.
    const findFirstShowcase = (n: TreeNode): string | null => {
      if (byId[n.id]) return n.id;
      for (const child of n.children ?? []) {
        const found = findFirstShowcase(child);
        if (found) return found;
      }
      return null;
    };
    const first = findFirstShowcase(node);
    if (first) {
      setActiveShowcaseId(first);
      setActiveTab('overview');
    }
  }, [byId]);


  const handleToggle = useCallback((id: string, expanded: boolean): void => {
    setExpandedIds((prev) => {
      const set = new Set(prev);
      if (expanded) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  }, []);

  const breadcrumbItems = useMemo(() => {
    if (!activeShowcase) return [];
    const level = LIBRARY_LEVELS.find((l) => l.id === activeShowcase.meta.level);
    const siblings = allShowcases.filter(
      (s) => s.meta.level === activeShowcase.meta.level && s.meta.category === activeShowcase.meta.category,
    );
    const isSingleChildCategory = siblings.length === 1;
    const items = [
      { label: level?.label ?? activeShowcase.meta.level, id: `level-${activeShowcase.meta.level}` },
      { label: activeShowcase.meta.title, id: activeShowcase.id, current: true },
    ];
    if (!isSingleChildCategory) {
      items.splice(1, 0, { label: activeShowcase.meta.category, id: `cat-${activeShowcase.meta.level}-${activeShowcase.meta.category}` });
    }
    return items;
  }, [activeShowcase, allShowcases]);

  const handlePrevious = useCallback((): void => {
    const idx = filtered.findIndex((s) => s.id === activeShowcase?.id);
    if (idx > 0) setActiveShowcaseId(filtered[idx - 1].id);
  }, [activeShowcase, filtered]);

  const handleNext = useCallback((): void => {
    const idx = filtered.findIndex((s) => s.id === activeShowcase?.id);
    if (idx >= 0 && idx < filtered.length - 1) setActiveShowcaseId(filtered[idx + 1].id);
  }, [activeShowcase, filtered]);

  if (allShowcases.length === 0) return null;

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <Heading level={1} size={3} className={styles.topbarTitle}>
            Design System
          </Heading>
          <Text color="secondary" as="span" className={styles.topbarMeta}>
            {filtered.length} of {allShowcases.length} components
          </Text>
        </div>
        <div className={styles.topbarRight}>
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
        </div>
      </header>

      <div className={styles.main}>
        <aside className={styles.sidebar} aria-label="Library tree">
          <div className={styles.sidebarHeader}>
            <h1 className={styles.sidebarTitle}>Design System</h1>
            <p className={styles.sidebarSubtitle}>Quiet confidence</p>
          </div>
          <Tree
            nodes={treeData}
            activeId={activeShowcase?.id}
            expandedIds={expandedIds}
            onSelect={handleSelect}
            onToggle={handleToggle}
            ariaLabel="Library navigation tree"
          />
          <Card className={styles.resultCard}>
            <Text as="p" color="secondary" className={styles.resultText}>
              Showing {filtered.length} / {allShowcases.length} items
            </Text>
          </Card>
        </aside>

        <main className={styles.detail}>
          {activeShowcase ? (
            <>
              <div className={styles.breadcrumbBar}>
                <Breadcrumb items={breadcrumbItems} />
                <div className={styles.detailNav}>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={filtered.findIndex((s) => s.id === activeShowcase.id) === 0}
                    aria-label="Previous component"
                  >
                    <Icon name="chevronLeft" size={18} />
                  </IconButton>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleNext}
                    disabled={filtered.findIndex((s) => s.id === activeShowcase.id) === filtered.length - 1}
                    aria-label="Next component"
                  >
                    <Icon name="chevronRight" size={18} />
                  </IconButton>
                </div>
              </div>

              <section className={styles.preview} aria-label="Component preview">
                <Card className={styles.previewCard}>
                  <MockProviders>
                    <activeShowcase.Component />
                  </MockProviders>
                </Card>
              </section>

              <section className={styles.info} aria-labelledby="detail-title">
                <div className={styles.infoHeader}>
                  <Heading level={2} size={2} id="detail-title" className={styles.infoTitle}>
                    {activeShowcase.meta.title}
                  </Heading>
                  {activeShowcase.meta.status && (
                    <Text as="span" color="secondary" className={styles.statusBadge}>
                      {activeShowcase.meta.status}
                    </Text>
                  )}
                </div>

                <Text color="secondary" as="p" className={styles.infoDesc}>
                  {activeShowcase.meta.description}
                </Text>

                <div className={styles.metaRow}>
                  <Text as="span" color="secondary" className={styles.metaItem}>
                    Level: {LIBRARY_LEVELS.find((l) => l.id === activeShowcase.meta.level)?.label ?? activeShowcase.meta.level}
                  </Text>
                  <Text as="span" color="secondary" className={styles.metaItem}>
                    Category: {activeShowcase.meta.category}
                  </Text>
                </div>

                <div className={styles.variants}>
                  <Text as="span" variant="label" className={styles.variantsLabel}>
                    Links:
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const params = new URLSearchParams(window.location.search);
                      params.set('showcase', encodeURIComponent(activeShowcase.meta.title));
                      window.history.replaceState(null, '', `?${params.toString()}`);
                    }}
                  >
                    Copy link
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handlePrevious} disabled={filtered.findIndex((s) => s.id === activeShowcase.id) === 0}>
                    Previous
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleNext} disabled={filtered.findIndex((s) => s.id === activeShowcase.id) === filtered.length - 1}>
                    Next
                  </Button>
                </div>
              </section>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DetailTab)}>
                <Tabs.List className={styles.tabsList}>
                  <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
                  <Tabs.Trigger value="tokens">Tokens</Tabs.Trigger>
                  <Tabs.Trigger value="usage">Usage</Tabs.Trigger>
                  <Tabs.Trigger value="code">Code</Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="overview" className={styles.tabContent}>
                  <Text as="p" color="secondary">
                    {activeShowcase.meta.description || 'No overview available.'}
                  </Text>
                </Tabs.Content>
                <Tabs.Content value="tokens" className={styles.tabContent}>
                  <Text as="p" color="secondary">
                    Token documentation is generated from the component CSS module. Inspect the source for available custom properties.
                  </Text>
                </Tabs.Content>
                <Tabs.Content value="usage" className={styles.tabContent}>
                  <Text as="p" color="secondary">
                    Import and compose with other atoms. Refer to the showcase file at <Code>{activeShowcase.path}</Code> for live examples.
                  </Text>
                </Tabs.Content>
                <Tabs.Content value="code" className={styles.tabContent}>
                  <pre className={styles.codeBlock}>
                    <Code>{`import { ${activeShowcase.meta.title.replace(/\s+/g, '')} } from '@/shared/ui';

<${activeShowcase.meta.title.replace(/\s+/g, '')} />`}</Code>
                  </pre>
                </Tabs.Content>
              </Tabs>
            </>
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
