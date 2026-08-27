import { useCallback, useRef } from 'react';
import { Icon } from '@/shared/icons/Icon';
import type { ICON_CATALOG } from '@/shared/icons';
import styles from './Tree.module.css';

export interface TreeNode {
  /** Stable unique id. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional icon name from ICON_CATALOG. */
  icon?: keyof typeof ICON_CATALOG;
  /** Child nodes. */
  children?: TreeNode[];
}

export interface TreeProps {
  /** Top-level nodes. */
  nodes: TreeNode[];
  /** Active/selected node id. */
  activeId?: string;
  /** Expanded branch ids. */
  expandedIds: string[];
  /** Called when a node is selected. */
  onSelect: (id: string, node: TreeNode) => void;
  /** Called when a branch is expanded/collapsed. */
  onToggle: (id: string, expanded: boolean) => void;
  /** Optional class name. */
  className?: string;
  /** Accessible label for the tree. */
  ariaLabel?: string;
}

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  activeId?: string;
  expandedSet: Set<string>;
  onSelect: (id: string, node: TreeNode) => void;
  onToggle: (id: string) => void;
}

function TreeItem({ node, depth, activeId, expandedSet, onSelect, onToggle }: TreeItemProps): React.JSX.Element {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedSet.has(node.id);
  const isActive = activeId === node.id;
  const itemRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((): void => {
    if (hasChildren) {
      onToggle(node.id);
    }
    onSelect(node.id, node);
  }, [hasChildren, node, onSelect, onToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <div
      ref={itemRef}
      className={styles.branch}
      role="treeitem"
      tabIndex={0}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isActive}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className={[
          styles.node,
          styles[`depth${Math.min(depth, 2)}`],
          isActive ? styles.active : '',
          hasChildren ? styles.branchNode : styles.leafNode,
        ].filter(Boolean).join(' ')}
        role="none"
      >
        {hasChildren ? (
          <span className={[styles.chevron, isExpanded ? '' : styles.collapsed].filter(Boolean).join(' ')}>
            <Icon name="chevronDown" size={14} />
          </span>
        ) : (
          <span className={styles.leading} aria-hidden="true">
            {node.icon ? <Icon name={node.icon} size={16} /> : null}
          </span>
        )}
        <span className={styles.label}>{node.label}</span>
      </div>

      {hasChildren && isExpanded && (
        <div className={styles.children} role="group" aria-label={node.label}>
          {node.children?.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              expandedSet={expandedSet}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Tree({
  nodes,
  activeId,
  expandedIds,
  onSelect,
  onToggle,
  className,
  ariaLabel,
}: TreeProps): React.JSX.Element {
  const expandedSet = new Set(expandedIds);

  const handleToggle = useCallback(
    (id: string): void => {
      onToggle(id, !expandedSet.has(id));
    },
    [expandedSet, onToggle],
  );

  return (
    <nav className={[styles.tree, className ?? ''].filter(Boolean).join(' ')} aria-label={ariaLabel} role="tree">
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={0}
          activeId={activeId}
          expandedSet={expandedSet}
          onSelect={onSelect}
          onToggle={handleToggle}
        />
      ))}
    </nav>
  );
}
