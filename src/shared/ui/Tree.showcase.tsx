import { useCallback, useState, type ReactElement } from 'react';
import { Tree } from './Tree';
import type { TreeNode } from './Tree';

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const panelStyle: React.CSSProperties = {
  maxWidth: 'calc(var(--space-5) * 18)',
  padding: 'var(--space-3)',
  border: 'var(--border-width-hairline) solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-card)',
  background: 'var(--color-surface)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  letterSpacing: 'var(--tracking-tight)',
  textTransform: 'uppercase',
};

const NODES: TreeNode[] = [
  {
    id: 'library',
    label: 'Library',
    children: [
      { id: 'favorites', label: 'Favorites', icon: 'bookOpen' },
      { id: 'watch-later', label: 'Watch later', icon: 'fileVideo' },
      {
        id: 'folders',
        label: 'Folders',
        children: [
          { id: 'movies', label: 'Movies', icon: 'video' },
          { id: 'series', label: 'Series', icon: 'video' },
        ],
      },
    ],
  },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function Showcase(): ReactElement {
  const [expandedIds, setExpandedIds] = useState<string[]>(['library', 'folders']);
  const [activeId, setActiveId] = useState<string>('favorites');

  const handleToggle = useCallback((id: string, expanded: boolean): void => {
    setExpandedIds((prev) => (expanded ? [...prev, id] : prev.filter((i) => i !== id)));
  }, []);

  return (
    <div style={rootStyle}>
      <div style={labelStyle}>Controlled tree</div>
      <div style={panelStyle}>
        <Tree
          nodes={NODES}
          activeId={activeId}
          expandedIds={expandedIds}
          onSelect={(id) => setActiveId(id)}
          onToggle={handleToggle}
          ariaLabel="Media library tree"
        />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Tree',
  description: 'Expandable nested navigation tree with active selection, branch chevrons, and leaf icons.',
  level: 'molecules',
  category: 'Navigation',
  status: 'stable' as const,
};
