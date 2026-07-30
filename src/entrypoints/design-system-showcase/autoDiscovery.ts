import type { ComponentType } from 'react';

export interface ShowcaseMeta {
  /** Display title for the showcase card. */
  title: string;
  /** Group name used to cluster showcases into sections. */
  group: string;
  /** Optional ordering inside the group (default 0). */
  order?: number;
}

export interface ShowcaseModule {
  /** Named export for the showcase component. */
  Showcase?: ComponentType<Record<string, never>>;
  /** Fallback default export. */
  default?: ComponentType<Record<string, never>>;
  /** Metadata controlling title, group, and order. */
  showcaseMeta?: ShowcaseMeta;
}

export interface DiscoveredShowcase {
  /** Unique path used as React key. */
  id: string;
  /** Vite module path. */
  path: string;
  /** Normalized metadata. */
  meta: ShowcaseMeta;
  /** Showcase component to render. */
  Component: ComponentType<Record<string, never>>;
}

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

function inferGroup(path: string): string {
  if (path.startsWith('/src/shared/ui/')) return 'Shared UI';
  const domainMatch = /\/src\/shared\/domain\/([^/]+)\/atoms\//.exec(path);
  if (domainMatch) {
    return `Domain — ${domainMatch[1].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase())}`;
  }
  const featureMatch = /\/src\/features\/([^/]+)\/ui\//.exec(path);
  if (featureMatch) {
    return featureMatch[1].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase());
  }
  return 'Components';
}

export function discoverShowcases(): DiscoveredShowcase[] {
  const result: DiscoveredShowcase[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    const Component = mod.Showcase ?? mod.default;
    if (!Component) continue;

    const meta: ShowcaseMeta = {
      title: mod.showcaseMeta?.title ?? inferTitle(path),
      group: mod.showcaseMeta?.group ?? inferGroup(path),
      order: mod.showcaseMeta?.order,
    };

    result.push({ id: path, path, meta, Component });
  }
  return result.sort((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0));
}

export function groupShowcases(showcases: DiscoveredShowcase[]): Record<string, DiscoveredShowcase[]> {
  const groups: Record<string, DiscoveredShowcase[]> = {};
  for (const showcase of showcases) {
    (groups[showcase.meta.group] ??= []).push(showcase);
  }
  return groups;
}
