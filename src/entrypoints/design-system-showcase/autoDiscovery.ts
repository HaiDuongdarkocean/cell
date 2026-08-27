import type { ComponentType } from 'react';
import { createElement } from 'react';
import { MissingShowcasePlaceholder } from './MissingShowcasePlaceholder';
import {
  applyMetadata,
  CANONICAL_META,
  type DiscoveredShowcase,
  getCategoryPriority,
  inferBasename,
  LIBRARY_LEVELS,
  type ShowcaseModule,
  titleSortKey,
} from './autoDiscovery.logic';

export {
  applyMetadata,
  CANONICAL_META,
  countByLevel,
  countMissing,
  countUnclassified,
  getCategoryPriority,
  groupByCategory,
  groupByLevel,
  groupByLevelThenCategory,
  inferBasename,
  inferCategoryFromBasename,
  inferLevelFromPath,
  inferTitle,
  normalizeCategory,
  type DiscoveredShowcase,
  type LibraryLevel,
  type LibraryLevelInfo,
  LIBRARY_LEVELS,
  type RawShowcaseMeta,
  type ShowcaseMeta,
  type ShowcaseModule,
  type ShowcaseStatus,
} from './autoDiscovery.logic';

// ─── Discovery ──────────────────────────────────────────────────────

const modules = import.meta.glob(
  [
    '/src/shared/ui/*.showcase.tsx',
    '/src/shared/styles/*.showcase.tsx',
    '/src/shared/domain/*/atoms/*.showcase.tsx',
    '/src/features/*/ui/*.showcase.tsx',
    '/src/features/*/molecules/*.showcase.tsx',
    '/src/features/*/organisms/*.showcase.tsx',
    '/src/entrypoints/design-system-showcase/pages/*.showcase.tsx',
    '/src/entrypoints/design-system-showcase/templates/*.showcase.tsx',
  ],
  { eager: true },
) as Record<string, ShowcaseModule>;

/** Non-showcase component .tsx files in shared/ui — used to detect missing documentation. */
const sharedUiComponentFiles = import.meta.glob(
  ['/src/shared/ui/*.tsx', '!/src/shared/ui/*.showcase.tsx', '!/src/shared/ui/*.test.tsx'],
  { eager: true },
) as Record<string, object>;

export function discoverShowcases(): DiscoveredShowcase[] {
  const result: DiscoveredShowcase[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    const Component = mod.Showcase ?? mod.default;
    if (!Component) continue;

    const basename = inferBasename(path);
    const canonical = CANONICAL_META[basename];
    if (canonical?.hidden) continue;

    const { meta, unclassified } = applyMetadata(path, mod.showcaseMeta, basename);
    result.push({
      id: path,
      path,
      meta,
      missing: false,
      unclassified,
      Component,
    });
  }
  return result.sort((a, b) => {
    const levelDiff = LIBRARY_LEVELS.findIndex((l) => l.id === a.meta.level) - LIBRARY_LEVELS.findIndex((l) => l.id === b.meta.level);
    if (levelDiff !== 0) return levelDiff;
    const catDiff = getCategoryPriority(a.meta.level, a.meta.category) - getCategoryPriority(b.meta.level, b.meta.category);
    if (catDiff !== 0) return catDiff;
    return titleSortKey(a, b);
  });
}

/**
 * Discover shared/ui components that do not have a `.showcase.tsx` file.
 * These render as placeholder previews so documentation never silently lags.
 */
export function discoverMissingShowcases(): DiscoveredShowcase[] {
  const showcaseBasenames = new Set(Object.keys(modules).map(inferBasename));
  const componentBasenames = Object.keys(sharedUiComponentFiles)
    .filter((p) => !p.endsWith('index.ts'))
    .map(inferBasename);

  const result: DiscoveredShowcase[] = [];
  for (const basename of componentBasenames) {
    if (showcaseBasenames.has(basename)) continue;
    const canonical = CANONICAL_META[basename];
    if (canonical?.hidden) continue;

    const path = `/src/shared/ui/${basename}.tsx`;
    const { meta } = applyMetadata(path, undefined, basename);
    const Component: ComponentType<Record<string, never>> = () =>
      createElement(MissingShowcasePlaceholder, { title: meta.title });

    result.push({
      id: `missing-${basename}`,
      path,
      meta,
      missing: true,
      unclassified: false,
      Component,
    });
  }
  return result.sort((a, b) => {
    const levelDiff = LIBRARY_LEVELS.findIndex((l) => l.id === a.meta.level) - LIBRARY_LEVELS.findIndex((l) => l.id === b.meta.level);
    if (levelDiff !== 0) return levelDiff;
    const catDiff = getCategoryPriority(a.meta.level, a.meta.category) - getCategoryPriority(b.meta.level, b.meta.category);
    if (catDiff !== 0) return catDiff;
    return titleSortKey(a, b);
  });
}
