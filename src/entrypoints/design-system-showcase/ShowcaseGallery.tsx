import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import {
  discoverShowcases,
  groupByLevelThenCategory,
  countByLevel,
  LIBRARY_LEVELS,
  type LibraryLevel,
  type DiscoveredShowcase,
} from './autoDiscovery';
import { MockProviders } from './mockProviders';
import { ViewportFrame, VIEWPORT_PRESETS, type ViewportWidth } from './ViewportFrame';
import { Icon } from '@/shared/icons/Icon';
import styles from './ShowcaseGallery.module.css';

const SUPPORTED_LEVELS = LIBRARY_LEVELS.filter((l) => l.supported);

type ThemeMode = 'light' | 'dark';

const PAGE_BREAKPOINTS = [
  { label: 'S', sub: '320', value: 320 as ViewportWidth },
  { label: 'M', sub: '425', value: 425 as ViewportWidth },
  { label: 'T', sub: '768', value: 768 as ViewportWidth },
  { label: 'L', sub: '1024', value: 1024 as ViewportWidth },
  { label: 'D', sub: '1280', value: 1280 as ViewportWidth },
  { label: 'Fit', sub: '100%', value: 'full' as ViewportWidth },
] as const;

export function ShowcaseGallery(): ReactElement | null {
  const [filter, setFilter] = useState('');
  const [activeLevel, setActiveLevel] = useState<LibraryLevel | null>('foundations');
  const [fullscreenShowcase, setFullscreenShowcase] = useState<DiscoveredShowcase | null>(null);
  const [viewportWidth, setViewportWidth] = useState<ViewportWidth>('full');
  const [pageViewport, setPageViewport] = useState<ViewportWidth>('full');
  const [mode, setMode] = useState<ThemeMode>('light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleMode = useCallback(() => setMode((m) => (m === 'light' ? 'dark' : 'light')), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const closeFullscreen = useCallback(() => setFullscreenShowcase(null), []);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollResetKey = String(pageViewport);

  // Disable browser scroll restoration + reset on breakpoint switch
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  // Callback ref: reset scroll immediately when content element mounts
  const contentCallbackRef = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (node) node.scrollTop = 0;
  }, []);

  // Fallback reset after layout settles (browser may restore scroll post-mount)
  useEffect(() => {
    const reset = (): void => {
      if (contentRef.current) {
        contentRef.current.scrollTo({ top: 0, left: 0 });
      }
    };
    const id1 = setTimeout(reset, 0);
    const id2 = setTimeout(reset, 100);
    const id3 = setTimeout(reset, 300);
    return () => { clearTimeout(id1); clearTimeout(id2); clearTimeout(id3); };
  }, [pageViewport]);

  useEffect(() => {
    if (!fullscreenShowcase) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeFullscreen();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [fullscreenShowcase, closeFullscreen]);

  const allShowcases = useMemo(() => discoverShowcases(), []);
  const levelCounts = useMemo(() => countByLevel(allShowcases), [allShowcases]);
  const grouped = useMemo(() => groupByLevelThenCategory(allShowcases), [allShowcases]);

  const totalCount = allShowcases.length;

  const filteredGrouped = useMemo(() => {
    if (!filter.trim()) return grouped;
    const q = filter.toLowerCase();
    const result: Record<LibraryLevel, Record<string, DiscoveredShowcase[]>> = {
      foundations: {},
      atoms: {},
      molecules: {},
      organisms: {},
      pages: {},
    };
    for (const level of ['foundations', 'atoms', 'molecules', 'organisms', 'pages'] as LibraryLevel[]) {
      for (const [cat, items] of Object.entries(grouped[level])) {
        const matched = items.filter(
          (s) =>
            s.meta.title.toLowerCase().includes(q) ||
            s.meta.description.toLowerCase().includes(q) ||
            s.meta.category.toLowerCase().includes(q) ||
            s.meta.level.includes(q),
        );
        if (matched.length > 0) result[level][cat] = matched;
      }
    }
    return result;
  }, [grouped, filter]);

  const visibleCount = useMemo(() => {
    let n = 0;
    for (const level of ['foundations', 'atoms', 'molecules', 'organisms', 'pages'] as LibraryLevel[]) {
      for (const items of Object.values(filteredGrouped[level])) n += items.length;
    }
    return n;
  }, [filteredGrouped]);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value);

  const toggleCategory = useCallback((key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleNavClick = (level: LibraryLevel, category?: string, showcaseId?: string) => {
    setActiveLevel(level);
    if (showcaseId) {
      closeSidebar();
      document.getElementById(`showcase-${showcaseId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (category) {
      const id = `library-${level}-${category.replace(/[^a-zA-Z0-9]/g, '-')}`;
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const id = `library-${level}`;
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (totalCount === 0) return null;

  const layoutContent = (
    <div className={styles.layout}>
      <button
        type="button"
        className={styles.menuBtn}
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation"
      >
        <Icon name="menu" size={20} />
      </button>

      {sidebarOpen && <div className={styles.backdrop} onClick={closeSidebar} aria-hidden="true" />}

      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}
        aria-label="Library navigation"
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarHeaderLeft}>
            <h1 className={styles.sidebarTitle}>Design System</h1>
            <span className={styles.sidebarSubtitle}>{totalCount} components</span>
          </div>
          <div className={styles.sidebarHeaderRight}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={toggleMode}
              aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
            >
              <Icon name={mode === 'light' ? 'moon' : 'sun'} size={18} />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.collapseBtn}`}
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!sidebarCollapsed}
            >
              <Icon name={sidebarCollapsed ? 'chevronRight' : 'chevronLeft'} size={18} />
            </button>
          </div>
        </div>

        <div className={styles.sidebarSearch}>
          <Icon name="search" size={16} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search library..."
            value={filter}
            onChange={handleSearch}
            aria-label="Search library"
          />
          <span className={styles.resultCount}>{visibleCount}</span>
        </div>

        <nav className={`${styles.sidebarNav} ${styles.sidebarNavFull}`} aria-hidden={sidebarCollapsed}>
          {LIBRARY_LEVELS.map((levelInfo) => {
            if (!levelInfo.supported) {
              return (
                <div key={levelInfo.id} className={styles.sidebarDisabled}>
                  <span className={styles.sidebarDisabledLeft}>
                    <Icon name={levelInfo.icon} size={18} />
                    <span className={styles.sidebarDisabledLabel}>{levelInfo.label}</span>
                  </span>
                  <span className={styles.sidebarComingLater}>Coming later</span>
                </div>
              );
            }
            const level = levelInfo.id as LibraryLevel;
            const isActive = activeLevel === level;
            const count = levelCounts[level];
            const categories = Object.keys(grouped[level]).sort();
            return (
              <div key={levelInfo.id} className={styles.sidebarLevelGroup}>
                <button
                  type="button"
                  className={`${styles.sidebarLevel} ${isActive ? styles.sidebarLevelActive : ''}`}
                  onClick={() => handleNavClick(level)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className={styles.sidebarLevelIcon}>
                    <Icon name={levelInfo.icon} size={18} />
                  </span>
                  <span className={styles.sidebarLevelLabel}>{levelInfo.label}</span>
                  <span className={styles.sidebarCount}>{count}</span>
                </button>
                {categories.map((cat) => {
                  const catKey = `${level}-${cat}`;
                  const isExpanded = expandedCategories.has(catKey);
                  const catShowcases = grouped[level][cat];
                  return (
                    <div key={cat} className={styles.sidebarCategoryGroup}>
                      <button
                        type="button"
                        className={styles.sidebarCategory}
                        onClick={() => { handleNavClick(level, cat); toggleCategory(catKey); }}
                      >
                        <span className={styles.sidebarCategoryLabel}>
                          <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} size={12} className={styles.sidebarChevron} />
                          {cat}
                        </span>
                        <span className={styles.sidebarCount}>{catShowcases.length}</span>
                      </button>
                      {isExpanded && (
                        <div className={styles.sidebarItems}>
                          {catShowcases.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className={styles.sidebarItem}
                              onClick={() => handleNavClick(level, cat, s.id)}
                              title={s.meta.description}
                            >
                              {s.meta.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <nav className={`${styles.sidebarNav} ${styles.sidebarNavRail}`} aria-hidden={!sidebarCollapsed}>
          {LIBRARY_LEVELS.map((levelInfo) => {
            const level = levelInfo.id as LibraryLevel;
            const isActive = activeLevel === level;
            return (
              <button
                key={levelInfo.id}
                type="button"
                className={`${styles.railItem} ${isActive ? styles.railItemActive : ''} ${!levelInfo.supported ? styles.railItemDisabled : ''}`}
                onClick={() => levelInfo.supported && handleNavClick(level)}
                aria-current={isActive ? 'true' : undefined}
                aria-label={levelInfo.label}
                disabled={!levelInfo.supported}
              >
                <Icon name={levelInfo.icon} size={20} />
              </button>
            );
          })}
        </nav>
      </aside>

      <div ref={contentCallbackRef} className={styles.content}>
        <div className={styles.contentInner}>
        {visibleCount === 0 && filter.trim() && (
          <div className={styles.emptyState}>No items match &quot;{filter}&quot;</div>
        )}
        {SUPPORTED_LEVELS.map((levelInfo) => {
          const level = levelInfo.id as LibraryLevel;
          const categories = filteredGrouped[level];
          const categoryEntries = Object.entries(categories).sort(([a], [b]) => a.localeCompare(b));
          if (categoryEntries.length === 0) return null;
          const levelId = `library-${level}`;
          const isFoundation = level === 'foundations';
          return (
            <section
              key={level}
              id={levelId}
              className={`${styles.levelSection} ${isFoundation ? styles.levelSectionFoundation : styles.levelSectionGrid}`}
            >
              <div className={styles.levelHeader}>
                <span className={styles.levelNumber}>
                  {String(levelInfo.order).padStart(2, '0')}
                </span>
                <h2 className={styles.levelTitle}>{levelInfo.label}</h2>
                <span className={styles.levelCount}>{levelCounts[level]} items</span>
              </div>
              {categoryEntries.map(([category, showcases]) => {
                const categoryId = `library-${level}-${category.replace(/[^a-zA-Z0-9]/g, '-')}`;
                return (
                  <div key={category} id={categoryId} className={styles.categorySection}>
                    <h3 className={styles.categoryTitle}>{category}</h3>
                    <div
                      className={`${styles.gallery} ${isFoundation ? styles.galleryFoundation : styles.galleryGrid}`}
                    >
                      {showcases.map((showcase, showcaseIdx) => {
                        const isPage = level === 'pages';
                        return (
                        <div
                          className={`${styles.card} ${isFoundation ? styles.cardFoundation : isPage ? styles.cardPage : styles.cardGrid}`}
                          key={showcase.id}
                          id={`showcase-${showcase.id}`}
                          style={{ animationDelay: `${Math.min(showcaseIdx * 40, 320)}ms` }}
                        >
                          <div className={styles.cardHeader}>
                            <h4 className={styles.cardTitle}>{showcase.meta.title}</h4>
                            <div className={styles.cardHeaderRight}>
                              {showcase.meta.status && (
                                <span className={styles.cardStatus}>{showcase.meta.status}</span>
                              )}
                              {isPage && (
                                <button
                                  type="button"
                                  className={styles.fullscreenBtn}
                                  onClick={() => {
                                    setViewportWidth('full');
                                    setFullscreenShowcase(showcase);
                                  }}
                                  aria-label={`Open ${showcase.meta.title} fullscreen`}
                                >
                                  <Icon name="maximize" size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                          {showcase.meta.description && (
                            <p className={styles.cardDescription}>{showcase.meta.description}</p>
                          )}
                          <div className={styles.cardBody}>
                            <MockProviders>
                              <showcase.Component />
                            </MockProviders>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
        </div>
      </div>

      {fullscreenShowcase && (
        <div className={styles.fullscreenOverlay} role="dialog" aria-modal="true" aria-label={fullscreenShowcase.meta.title}>
          <div className={styles.fullscreenBar}>
            <div className={styles.fullscreenBarLeft}>
              <span className={styles.fullscreenCategory}>{fullscreenShowcase.meta.category}</span>
              <h2 className={styles.fullscreenTitle}>{fullscreenShowcase.meta.title}</h2>
            </div>
            <div className={styles.fullscreenBarRight}>
              <div className={styles.viewportSelector} role="group" aria-label="Viewport width">
                {VIEWPORT_PRESETS.map((preset) => (
                  <button
                    key={String(preset.value)}
                    type="button"
                    className={`${styles.viewportBtn} ${viewportWidth === preset.value ? styles.viewportBtnActive : ''}`}
                    onClick={() => setViewportWidth(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.fullscreenClose}
                onClick={closeFullscreen}
                aria-label="Close fullscreen"
              >
                <Icon name="x" size={20} />
              </button>
            </div>
          </div>
          <div className={styles.fullscreenBody}>
            <ViewportFrame key={String(viewportWidth)} width={viewportWidth} height={VIEWPORT_PRESETS.find((p) => p.value === viewportWidth)?.height}>
              <MockProviders>
                <fullscreenShowcase.Component />
              </MockProviders>
            </ViewportFrame>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`${styles.root} ${styles.rootWithToolbar} ${pageViewport !== 'full' ? styles.rootBreakpoint : ''}`}>
      <div className={styles.viewportToolbar} role="group" aria-label="Page viewport breakpoint">
        {PAGE_BREAKPOINTS.map((bp) => (
          <button
            key={String(bp.value)}
            type="button"
            className={`${styles.bpBtn} ${pageViewport === bp.value ? styles.bpBtnActive : ''}`}
            onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); setPageViewport(bp.value); }}
            aria-label={`${bp.sub}px viewport`}
            aria-pressed={pageViewport === bp.value}
          >
            <span className={styles.bpLabel}>{bp.label}</span>
            <span className={styles.bpSub}>{bp.sub}</span>
          </button>
        ))}
      </div>
      {pageViewport === 'full' ? (
        <div key="full" className={styles.fullWrapper}>{layoutContent}</div>
      ) : (
        <ViewportFrame key={String(pageViewport)} width={pageViewport} height={VIEWPORT_PRESETS.find((p) => p.value === pageViewport)?.height}>
          {layoutContent}
        </ViewportFrame>
      )}
    </div>
  );
}
