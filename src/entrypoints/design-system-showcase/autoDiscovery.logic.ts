import type { ComponentType } from 'react';
import type { ICON_CATALOG } from '@/shared/icons';

// ─── Library taxonomy ──────────────────────────────────────────────

/** Supported levels in this wave. */
export type LibraryLevel = 'foundations' | 'atoms' | 'molecules' | 'organisms' | 'templates' | 'pages';

/** Full roadmap including disabled levels. Used for navigation display. */
export interface LibraryLevelInfo {
  id: LibraryLevel | 'templates';
  label: string;
  supported: boolean;
  order: number;
  /** Icon id from ICON_CATALOG — shown in collapsed rail. */
  icon: keyof typeof ICON_CATALOG;
}

export const LIBRARY_LEVELS: readonly LibraryLevelInfo[] = [
  { id: 'foundations', label: 'Foundations', supported: true, order: 0, icon: 'layers' },
  { id: 'atoms', label: 'Atoms', supported: true, order: 1, icon: 'atom' },
  { id: 'molecules', label: 'Molecules', supported: true, order: 2, icon: 'molecule' },
  { id: 'organisms', label: 'Organisms', supported: true, order: 3, icon: 'organism' },
  { id: 'templates', label: 'Templates', supported: false, order: 4, icon: 'wireframe' },
  { id: 'pages', label: 'Pages', supported: true, order: 5, icon: 'windowPage' },
] as const;

export type ShowcaseStatus = 'stable' | 'experimental' | 'deprecated';

// ─── Metadata contract ─────────────────────────────────────────────

export interface ShowcaseMeta {
  /** Display title for the showcase card. */
  title: string;
  /** Short description shown in the library. */
  description: string;
  /** Brad Frost hierarchy level. May be explicit or inferred from path. */
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
  /** True when the showcase is missing a real component preview. */
  missing: boolean;
  /** True when level/category was missing and fallback was used (migration tracking). */
  unclassified: boolean;
  Component: ComponentType<Record<string, never>>;
}

// ─── Canonical taxonomy (SSOT) ─────────────────────────────────────

interface CanonicalOverride {
  title?: string;
  description?: string;
  level?: LibraryLevel;
  category?: string;
  order?: number;
  status?: ShowcaseStatus;
  hidden?: boolean;
}

/**
 * Override registry for exceptional cases only: hidden helpers, deprecated
 * archives, components without a `.showcase.tsx`, and rare title renames.
 * Normal level/category should come from `showcaseMeta` or path inference.
 */
export const CANONICAL_META: Record<string, CanonicalOverride> = {
  M3Tokens: {
    title: 'M3 Design Tokens',
    description: 'Reference archive: deprecated M3 tokens. Hidden from navigation.',
    level: 'foundations',
    category: 'Archive',
    status: 'deprecated',
    hidden: true,
  },

  ErrorBoundary: { hidden: true },
  useFocusTrap: { hidden: true },
  useIsMobile: { hidden: true },
  useSheet: { hidden: true },
};

/** Normalize legacy / duplicated category names to canonical categories. */
const CATEGORY_ALIASES: Record<string, string> = {
  'Shared UI — Action': 'Action',
  'Shared UI — Input': 'Input',
  'Shared UI — Data': 'Display',
  'Shared UI — Navigation': 'Navigation',
  'Shared UI — Feedback': 'Feedback',
  'Shared UI — Overlay': 'Overlay',
  'Generic Core': 'Content',
  'Subtitle — Layout': 'Layout',
  'Extension': 'Action',
  'Reference': 'Archive',
};

/** Desired category order for each level. Defines tree sort. */
export const CATEGORY_ORDER: Record<LibraryLevel, string[]> = {
  foundations: ['Overview', 'Color', 'Typography', 'Spacing', 'Shape', 'Motion', 'Iconography', 'Grid', 'Archive'],
  atoms: ['Action', 'Content', 'Layout', 'Input', 'Feedback', 'Display', 'Navigation', 'Utility', 'Overlay', 'Subtitle', 'Dictionary', 'Theme', 'TTS', 'Other'],
  molecules: ['Action', 'Content', 'Layout', 'Input', 'Feedback', 'Display', 'Navigation', 'Utility', 'Overlay', 'Subtitle', 'Dictionary', 'Theme', 'TTS', 'Card Creator', 'Other'],
  organisms: ['Navigation', 'Layout', 'Display', 'Subtitle', 'Dictionary', 'Theme', 'TTS', 'Card Creator', 'Other'],
  templates: ['Other'],
  pages: ['Overlay', 'Popup', 'Side Panel', 'Dialog', 'Settings', 'Video Player', 'Subtitle', 'Feature', 'Other'],
};

/** Category inferred from component basename when `showcaseMeta` does not provide one. */
const CATEGORY_PATTERNS: [RegExp, string][] = [
  [/^(Back|Close|Collapse|Copy|Info|Maximize|Minimize|Pin|Icon)?Button$|Button$/i, 'Action'],
  [/^NavItem$|^Nav$/i, 'Navigation'],
  [/^Toggle$|^Switch$/i, 'Action'],
  [/^(Input|Textarea|Select|Search|Slider|Checkbox|Radio|Shortcut|Field|Row|Group)$/i, 'Input'],
  [/^SettingsRow$|^FormGroup$|^LabelGroup$|^InputField$|^SearchField$|^SearchableSelect$|^SliderRow$|^CheckboxGroup$|^RadioGroup$/i, 'Input'],
  [/^(Dialog|Drawer|Sheet|BottomSheet|Tooltip|Overlay|Portal)$/i, 'Overlay'],
  [/^(Tabs|Tree|Breadcrumb|Pagination|Sidebar)$/i, 'Navigation'],
  [/^(Alert|HintIcon|StatusDot|Spinner|Skeleton|Progress|EmptyState)$/i, 'Feedback'],
  [/^(Card|ListItem|Accordion|Blockquote|Section|Box|Stack|Flex|Grid|Container|AspectRatio|Center|Separator|ResizeHandle|DragHandle|Collapsible|FooterBar)$/i, 'Display'],
  [/^(Avatar|Thumbnail|Image|Picture|Media|Video|Icon|Link)$/i, 'Content'],
  [/^(Text|Heading|Title|Label|Code|Kbd|Citation|Timestamp)$/i, 'Content'],
  [/^(Transition|Animation|Motion|VisuallyHidden)$/i, 'Utility'],
  [/^(Color|Spacing|Typography|Font|Shape|Motion|Iconography|Grid|Token|Token.*)$/i, 'Foundation'],
  [/^(OrbitalBadge|PopupDictionary|Subtitle.*|CardCreator.*|Dictionary.*)$/i, 'Dictionary'],
];

// ─── Helpers ───────────────────────────────────────────────────────

export function inferBasename(path: string): string {
  const match = /\/([^/]+?)\.showcase\.tsx$/.exec(path);
  return match ? match[1] : path.replace(/^.*\/(\w+)\.tsx$/, '$1');
}

export function inferTitle(path: string): string {
  const base = inferBasename(path);
  return base.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** Infer Brad Frost level from the file path. */
export function inferLevelFromPath(path: string): LibraryLevel {
  if (path.includes('/shared/styles/')) return 'foundations';
  if (path.includes('/design-system-showcase/pages/')) return 'pages';
  if (path.includes('/design-system-showcase/templates/')) return 'templates';
  if (path.includes('/features/') && path.includes('/organisms/')) return 'organisms';
  if (path.includes('/features/') && path.includes('/molecules/')) return 'molecules';
  if (path.includes('/features/') && path.includes('/ui/')) return 'organisms';
  if (path.includes('/domain/') && path.includes('/atoms/')) return 'atoms';
  if (path.includes('/shared/ui/')) return 'atoms';
  return 'atoms';
}

/** Infer category from component basename when metadata is missing. */
export function inferCategoryFromBasename(basename: string): string | undefined {
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(basename)) return category;
  }
  return undefined;
}

export function normalizeCategory(level: LibraryLevel, raw: string): string {
  const canonical = CATEGORY_ALIASES[raw] ?? raw;
  if (CATEGORY_ORDER[level].includes(canonical)) return canonical;
  return 'Other';
}

export function titleSortKey(a: DiscoveredShowcase, b: DiscoveredShowcase): number {
  return a.meta.title.localeCompare(b.meta.title);
}

export function getCategoryPriority(level: LibraryLevel, category: string): number {
  const idx = CATEGORY_ORDER[level].indexOf(category);
  return idx >= 0 ? idx : CATEGORY_ORDER[level].length;
}

/**
 * Build showcase metadata from path, file-level `showcaseMeta`, and canonical override.
 * Precedence:
 * 1. Path inference (default taxonomy for new files).
 * 2. `showcaseMeta` declared in the `.showcase.tsx` file.
 * 3. `CANONICAL_META` override for hidden/deprecated/special cases.
 */
export function applyMetadata(
  path: string,
  raw: RawShowcaseMeta | undefined,
  basename: string,
): { meta: ShowcaseMeta; unclassified: boolean } {
  const canonical = CANONICAL_META[basename];

  const levelFromPath = inferLevelFromPath(path);
  const level = canonical?.level ?? raw?.level ?? levelFromPath;

  const categoryFromName = inferCategoryFromBasename(basename);
  const rawCategory = canonical?.category ?? raw?.category ?? raw?.group ?? categoryFromName;
  const category = rawCategory ? normalizeCategory(level, rawCategory) : 'Other';

  const title = canonical?.title ?? raw?.title ?? inferTitle(path);
  const description = canonical?.description ?? raw?.description ?? '';

  // With path-based inference in place, every component has a deterministic
  // level/category. `unclassified` now only flags components whose taxonomy was
  // not explicitly declared by either `showcaseMeta` or `CANONICAL_META`.
  const unclassified =
    raw?.level === undefined &&
    canonical?.level === undefined &&
    raw?.category === undefined &&
    canonical?.category === undefined &&
    categoryFromName === undefined;

  return {
    meta: {
      title,
      description,
      level,
      category,
      status: canonical?.status ?? raw?.status,
    },
    unclassified,
  };
}

// ─── Grouping helpers ──────────────────────────────────────────────

export function groupByLevel(
  showcases: DiscoveredShowcase[],
): Record<LibraryLevel, DiscoveredShowcase[]> {
  const groups: Record<LibraryLevel, DiscoveredShowcase[]> = {
    foundations: [],
    atoms: [],
    molecules: [],
    organisms: [],
    templates: [],
    pages: [],
  };
  for (const s of showcases) {
    if (s.meta.level in groups) {
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
    molecules: {},
    organisms: {},
    templates: {},
    pages: {},
  };
  for (const s of showcases) {
    if (s.meta.level in result) {
      (result[s.meta.level][s.meta.category] ??= []).push(s);
    }
  }
  for (const level of Object.keys(result) as LibraryLevel[]) {
    const levelCats = CATEGORY_ORDER[level];
    const sorted = Object.entries(result[level]).sort(([a], [b]) => {
      const pa = levelCats.indexOf(a);
      const pb = levelCats.indexOf(b);
      if (pa !== pb) return (pa >= 0 ? pa : 999) - (pb >= 0 ? pb : 999);
      return a.localeCompare(b);
    });
    result[level] = Object.fromEntries(sorted);
  }
  return result;
}

/** Count items per level. */
export function countByLevel(showcases: DiscoveredShowcase[]): Record<LibraryLevel, number> {
  const counts: Record<LibraryLevel, number> = { foundations: 0, atoms: 0, molecules: 0, organisms: 0, templates: 0, pages: 0 };
  for (const s of showcases) {
    if (s.meta.level in counts) {
      counts[s.meta.level]++;
    }
  }
  return counts;
}

/** Count unclassified entries (migration tracking). */
export function countUnclassified(showcases: DiscoveredShowcase[]): number {
  return showcases.filter((s) => s.unclassified).length;
}

/** Count placeholder entries that still need a real showcase. */
export function countMissing(showcases: DiscoveredShowcase[]): number {
  return showcases.filter((s) => s.missing).length;
}
