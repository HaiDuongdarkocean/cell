import type { ComponentType } from 'react';

// ─── Library taxonomy ──────────────────────────────────────────────

/** Supported levels in this wave. Higher levels are roadmap-only (disabled). */
export type LibraryLevel = 'foundations' | 'atoms';

/** Full roadmap including disabled levels. Used for navigation display. */
export interface LibraryLevelInfo {
  id: LibraryLevel | 'molecules' | 'organisms' | 'templates' | 'pages';
  label: string;
  supported: boolean;
  order: number;
}

export const LIBRARY_LEVELS: readonly LibraryLevelInfo[] = [
  { id: 'foundations', label: 'Foundations', supported: true, order: 0 },
  { id: 'atoms', label: 'Atoms', supported: true, order: 1 },
  { id: 'molecules', label: 'Molecules', supported: false, order: 2 },
  { id: 'organisms', label: 'Organisms', supported: false, order: 3 },
  { id: 'templates', label: 'Templates', supported: false, order: 4 },
  { id: 'pages', label: 'Pages', supported: false, order: 5 },
] as const;

export type ShowcaseStatus = 'stable' | 'experimental' | 'deprecated';

// ─── Metadata contract ─────────────────────────────────────────────

export interface ShowcaseMeta {
  /** Display title for the showcase card. */
  title: string;
  /** Short description shown in the library. */
  description: string;
  /** Brad Frost hierarchy level. Must be explicit — never inferred from path. */
  level: LibraryLevel;
  /** UI-intent category within the level (e.g. "Color", "Action", "Input"). */
  category: string;
  /** Optional ordering inside the category (default 0). */
  order?: number;
  /** Optional lifecycle status. */
  status?: ShowcaseStatus;
}

/** Raw metadata as exported by showcase files. Allows gradual migration. */
export interface RawShowcaseMeta {
  title?: string;
  description?: string;
  level?: LibraryLevel;
  category?: string;
  order?: number;
  status?: ShowcaseStatus;
  /** Legacy field — kept for backward compat during migration. */
  group?: string;
}

export interface ShowcaseModule {
  Showcase?: ComponentType<Record<string, never>>;
  default?: ComponentType<Record<string, never>>;
  showcaseMeta?: RawShowcaseMeta;
}

export interface DiscoveredShowcase {
  id: string;
  path: string;
  meta: ShowcaseMeta;
  /** True when level was missing and fallback was used (migration tracking). */
  unclassified: boolean;
  Component: ComponentType<Record<string, never>>;
}

// ─── Discovery ──────────────────────────────────────────────────────

const modules = import.meta.glob(
  [
    '/src/shared/ui/*.showcase.tsx',
    '/src/shared/domain/*/atoms/*.showcase.tsx',
    '/src/features/*/ui/*.showcase.tsx',
  ],
  { eager: true },
) as Record<string, ShowcaseModule>;

function inferTitle(path: string): string {
  const match = /\/([^/]+?)\.showcase\.tsx$/.exec(path);
  return match ? match[1] : path;
}

/**
 * Discover all showcases. Entries without explicit `level` are marked
 * `unclassified: true` and assigned a placeholder level so they remain
 * visible during migration. No level is silently inferred from source path.
 */
export function discoverShowcases(): DiscoveredShowcase[] {
  const result: DiscoveredShowcase[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    const Component = mod.Showcase ?? mod.default;
    if (!Component) continue;

    const raw = mod.showcaseMeta;
    const hasLevel = raw?.level !== undefined;
    const meta: ShowcaseMeta = {
      title: raw?.title ?? inferTitle(path),
      description: raw?.description ?? '',
      level: raw?.level ?? 'atoms', // placeholder — unclassified flag tracks this
      category: raw?.category ?? raw?.group ?? 'Unclassified',
      order: raw?.order,
      status: raw?.status,
    };

    result.push({
      id: path,
      path,
      meta,
      unclassified: !hasLevel,
      Component,
    });
  }
  return result.sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0));
}

// ─── Grouping helpers ──────────────────────────────────────────────

export function groupByLevel(
  showcases: DiscoveredShowcase[],
): Record<LibraryLevel, DiscoveredShowcase[]> {
  const groups: Record<LibraryLevel, DiscoveredShowcase[]> = {
    foundations: [],
    atoms: [],
  };
  for (const s of showcases) {
    if (s.meta.level === 'foundations' || s.meta.level === 'atoms') {
      groups[s.meta.level].push(s);
    }
  }
  return groups;
}

export function groupByCategory(
  showcases: DiscoveredShowcase[],
): Record<string, DiscoveredShowcase[]> {
  const groups: Record<string, DiscoveredShowcase[]> = {};
  for (const s of showcases) {
    (groups[s.meta.category] ??= []).push(s);
  }
  return groups;
}

/** Group by level → category → items (two-level hierarchy). */
export function groupByLevelThenCategory(
  showcases: DiscoveredShowcase[],
): Record<LibraryLevel, Record<string, DiscoveredShowcase[]>> {
  const result: Record<LibraryLevel, Record<string, DiscoveredShowcase[]>> = {
    foundations: {},
    atoms: {},
  };
  for (const s of showcases) {
    if (s.meta.level === 'foundations' || s.meta.level === 'atoms') {
      (result[s.meta.level][s.meta.category] ??= []).push(s);
    }
  }
  return result;
}

/** Count items per level. */
export function countByLevel(showcases: DiscoveredShowcase[]): Record<LibraryLevel, number> {
  const counts: Record<LibraryLevel, number> = { foundations: 0, atoms: 0 };
  for (const s of showcases) {
    if (s.meta.level === 'foundations' || s.meta.level === 'atoms') {
      counts[s.meta.level]++;
    }
  }
  return counts;
}

/** Count unclassified entries (migration tracking). */
export function countUnclassified(showcases: DiscoveredShowcase[]): number {
  return showcases.filter((s) => s.unclassified).length;
}
