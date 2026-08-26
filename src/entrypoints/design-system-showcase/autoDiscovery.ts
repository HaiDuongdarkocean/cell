import type { ComponentType } from 'react';
import { createElement } from 'react';
import type { ICON_CATALOG } from '@/shared/icons';
import { MissingShowcasePlaceholder } from './MissingShowcasePlaceholder';

// ─── Library taxonomy ──────────────────────────────────────────────

/** Supported levels in this wave. */
export type LibraryLevel = 'foundations' | 'atoms' | 'molecules' | 'organisms' | 'pages';

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
  /** True when the showcase is missing a real component preview. */
  missing: boolean;
  /** True when level/category was missing and fallback was used (migration tracking). */
  unclassified: boolean;
  Component: ComponentType<Record<string, never>>;
}

// ─── Canonical taxonomy (SSOT) ─────────────────────────────────────

interface CanonicalMeta {
  title?: string;
  description?: string;
  level?: LibraryLevel;
  category?: string;
  order?: number;
  status?: ShowcaseStatus;
  hidden?: boolean;
}

/**
 * Single source of truth for showcase level / category.
 * Keyed by file basename (e.g. "Button", "Tabs", "M3Tokens").
 * If a component is not in this map, its raw `showcaseMeta` is used and only
 * the category name is normalized via `CATEGORY_ALIASES`.
 */
const CANONICAL_META: Record<string, CanonicalMeta> = {
  // Foundations
  M3Tokens: {
    title: 'M3 Design Tokens',
    description: 'Reference archive: deprecated M3 tokens. Hidden from navigation.',
    level: 'foundations',
    category: 'Archive',
    status: 'deprecated',
    hidden: true,
  },

  // Atoms — reclassify specialized buttons from molecules
  BackButton: { level: 'atoms', category: 'Action' },
  CloseButton: { level: 'atoms', category: 'Action' },
  CollapseButton: { level: 'atoms', category: 'Action' },
  CopyButton: { level: 'atoms', category: 'Action' },
  InfoButton: { level: 'atoms', category: 'Action' },
  MaximizeButton: { level: 'atoms', category: 'Action' },
  MinimizeButton: { level: 'atoms', category: 'Action' },
  PinButton: { level: 'atoms', category: 'Action' },
  Link: { level: 'atoms', category: 'Content' },
  Thumbnail: { level: 'atoms', category: 'Content' },

  // Molecules
  Tabs: { level: 'molecules', category: 'Navigation', title: 'Tabs' },
  Select: { level: 'molecules', category: 'Input' },
  Dialog: { level: 'molecules', category: 'Overlay' },
  Drawer: { level: 'molecules', category: 'Overlay' },
  Pagination: { level: 'molecules', category: 'Navigation' },
  Alert: { level: 'molecules', category: 'Feedback' },

  // Missing shared components (will be rendered as placeholders until showcases are written)
  Accordion: { level: 'molecules', category: 'Display' },
  Breadcrumb: { level: 'molecules', category: 'Navigation' },
  CheckboxGroup: { level: 'molecules', category: 'Input', title: 'Checkbox Group' },
  FormGroup: { level: 'molecules', category: 'Input', title: 'Form Group' },
  Header: { level: 'organisms', category: 'Display' },
  HintIcon: { level: 'molecules', category: 'Feedback', title: 'Hint Icon' },
  InputField: { level: 'molecules', category: 'Input', title: 'Input Field' },
  LabelGroup: { level: 'molecules', category: 'Input', title: 'Label Group' },
  ListItem: { level: 'molecules', category: 'Display', title: 'List Item' },
  RadioGroup: { level: 'molecules', category: 'Input', title: 'Radio Group' },
  SearchableSelect: { level: 'molecules', category: 'Input', title: 'Searchable Select' },
  SearchField: { level: 'molecules', category: 'Input', title: 'Search Field' },
  SettingsRow: { level: 'molecules', category: 'Input', title: 'Settings Row' },
  ShortcutInput: { level: 'molecules', category: 'Input', title: 'Shortcut Input' },
  SliderRow: { level: 'molecules', category: 'Input', title: 'Slider Row' },
  Tree: { level: 'molecules', category: 'Navigation' },

  // Non-UI / hook — keep hidden
  ErrorBoundary: { hidden: true },
  useFocusTrap: { hidden: true },

  // Feature organisms
  OrbitalBadge: { level: 'molecules', category: 'Dictionary' },
  SubtitleBlock: { level: 'atoms', category: 'Subtitle' },
  CardCreatorDialog: { level: 'organisms', category: 'Card Creator', title: 'Card Creator' },
  PopupDictionary: { level: 'organisms', category: 'Dictionary' },
  SubtitleManagerFooter: { level: 'organisms', category: 'Subtitle' },

  // Pages
  ClipboardPage: { level: 'pages', category: 'Side Panel' },
  DictionaryPopupPage: { level: 'pages', category: 'Popup' },
  PlayerModeOverlayPage: { level: 'pages', category: 'Overlay' },
  PopupPage: { level: 'pages', category: 'Popup' },
  SettingsPage: { level: 'pages', category: 'Settings' },
  SidePanelPage: { level: 'pages', category: 'Side Panel' },
  SubtitleOverlayPage: { level: 'pages', category: 'Overlay' },
  UniversalPanelPage: { level: 'pages', category: 'Side Panel' },
  VideoPlayerPage: { level: 'pages', category: 'Video Player' },
  SubtitleManagerPanel: { level: 'pages', category: 'Subtitle' },
  CardCreatorDialogPage: { level: 'pages', category: 'Dialog' },
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
const CATEGORY_ORDER: Record<LibraryLevel, string[]> = {
  foundations: ['Overview', 'Color', 'Typography', 'Spacing', 'Shape', 'Motion', 'Iconography', 'Grid', 'Archive'],
  atoms: ['Action', 'Content', 'Layout', 'Input', 'Feedback', 'Display', 'Navigation', 'Utility', 'Overlay', 'Subtitle', 'Dictionary', 'Theme', 'TTS', 'Other'],
  molecules: ['Action', 'Content', 'Layout', 'Input', 'Feedback', 'Display', 'Navigation', 'Utility', 'Overlay', 'Subtitle', 'Dictionary', 'Theme', 'TTS', 'Card Creator', 'Other'],
  organisms: ['Navigation', 'Layout', 'Display', 'Subtitle', 'Dictionary', 'Theme', 'TTS', 'Card Creator', 'Other'],
  pages: ['Overlay', 'Popup', 'Side Panel', 'Dialog', 'Settings', 'Video Player', 'Subtitle', 'Feature', 'Other'],
};

// ─── Helpers ───────────────────────────────────────────────────────

function inferBasename(path: string): string {
  const match = /\/([^/]+?)\.showcase\.tsx$/.exec(path);
  return match ? match[1] : path.replace(/^.*\/(\w+)\.tsx$/, '$1');
}

function inferTitle(path: string): string {
  const base = inferBasename(path);
  return base.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function normalizeCategory(level: LibraryLevel, raw: string): string {
  const canonical = CATEGORY_ALIASES[raw] ?? raw;
  if (CATEGORY_ORDER[level].includes(canonical)) return canonical;
  return 'Other';
}

function titleSortKey(a: DiscoveredShowcase, b: DiscoveredShowcase): number {
  return a.meta.title.localeCompare(b.meta.title);
}

export function getCategoryPriority(level: LibraryLevel, category: string): number {
  const idx = CATEGORY_ORDER[level].indexOf(category);
  return idx >= 0 ? idx : CATEGORY_ORDER[level].length;
}

function applyCanonical(
  path: string,
  raw: RawShowcaseMeta | undefined,
  basename: string,
): { meta: ShowcaseMeta; unclassified: boolean } {
  const canonical = CANONICAL_META[basename];
  const rawLevel = raw?.level ?? canonical?.level;
  const rawCategory = raw?.category ?? raw?.group ?? canonical?.category;
  const level = rawLevel ?? 'atoms';
  const category = rawCategory ? normalizeCategory(level, rawCategory) : 'Other';
  const title = canonical?.title ?? raw?.title ?? inferTitle(path);
  const description = canonical?.description ?? raw?.description ?? '';

  return {
    meta: {
      title,
      description,
      level,
      category,
      status: canonical?.status ?? raw?.status,
    },
    unclassified: raw?.level === undefined && canonical?.level === undefined && canonical?.hidden !== true,
  };
}

// ─── Discovery ──────────────────────────────────────────────────────

const modules = import.meta.glob(
  [
    '/src/shared/ui/*.showcase.tsx',
    '/src/shared/domain/*/atoms/*.showcase.tsx',
    '/src/features/*/ui/*.showcase.tsx',
    '/src/entrypoints/design-system-showcase/pages/*.showcase.tsx',
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

    const { meta, unclassified } = applyCanonical(path, mod.showcaseMeta, basename);
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
    const { meta } = applyCanonical(path, undefined, basename);
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

// ─── Grouping helpers ──────────────────────────────────────────────

export function groupByLevel(
  showcases: DiscoveredShowcase[],
): Record<LibraryLevel, DiscoveredShowcase[]> {
  const groups: Record<LibraryLevel, DiscoveredShowcase[]> = {
    foundations: [],
    atoms: [],
    molecules: [],
    organisms: [],
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
  const counts: Record<LibraryLevel, number> = { foundations: 0, atoms: 0, molecules: 0, organisms: 0, pages: 0 };
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
