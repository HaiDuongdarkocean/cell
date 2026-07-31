import { useMemo, useState, type ChangeEvent, type ReactElement } from 'react';
import {
  discoverShowcases,
  groupByLevelThenCategory,
  countByLevel,
  LIBRARY_LEVELS,
  type LibraryLevel,
  type DiscoveredShowcase,
} from './autoDiscovery';
import { MockProviders } from './mockProviders';
import styles from './ShowcaseGallery.module.css';

const SUPPORTED_LEVELS = LIBRARY_LEVELS.filter((l) => l.supported);

export function ShowcaseGallery(): ReactElement | null {
  const [filter, setFilter] = useState('');
  const [activeLevel, setActiveLevel] = useState<LibraryLevel | null>('foundations');

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
    };
    for (const level of ['foundations', 'atoms'] as LibraryLevel[]) {
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
    for (const level of ['foundations', 'atoms'] as LibraryLevel[]) {
      for (const items of Object.values(filteredGrouped[level])) n += items.length;
    }
    return n;
  }, [filteredGrouped]);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value);

  const handleNavClick = (level: LibraryLevel, category?: string) => {
    setActiveLevel(level);
    const id = category
      ? `library-${level}-${category.replace(/[^a-zA-Z0-9]/g, '-')}`
      : `library-${level}`;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (totalCount === 0) return null;

  return (
    <div className={styles.layout}>
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search library..."
          value={filter}
          onChange={handleSearch}
          aria-label="Search library"
        />
        <span className={styles.resultCount}>{visibleCount} items</span>
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="Library navigation">
          <nav className={styles.sidebarNav}>
            {LIBRARY_LEVELS.map((levelInfo) => {
              if (!levelInfo.supported) {
                return (
                  <div key={levelInfo.id} className={styles.sidebarDisabled}>
                    <span className={styles.sidebarDisabledLabel}>{levelInfo.label}</span>
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
                    <span>{levelInfo.label}</span>
                    <span className={styles.sidebarCount}>{count}</span>
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={styles.sidebarCategory}
                      onClick={() => handleNavClick(level, cat)}
                    >
                      <span>{cat}</span>
                      <span className={styles.sidebarCount}>{grouped[level][cat].length}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className={styles.content}>
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
                className={`${styles.levelSection} ${isFoundation ? styles.levelSectionFoundation : styles.levelSectionAtoms}`}
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
                        className={`${styles.gallery} ${isFoundation ? styles.galleryFoundation : styles.galleryAtoms}`}
                      >
                        {showcases.map((showcase) => (
                          <div
                            className={`${styles.card} ${isFoundation ? styles.cardFoundation : styles.cardAtom}`}
                            key={showcase.id}
                          >
                            <div className={styles.cardHeader}>
                              <h4 className={styles.cardTitle}>{showcase.meta.title}</h4>
                              {showcase.meta.status && (
                                <span className={styles.cardStatus}>{showcase.meta.status}</span>
                              )}
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
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
