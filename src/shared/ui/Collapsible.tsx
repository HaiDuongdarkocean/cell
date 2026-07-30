import type { ReactNode } from 'react';
import styles from './Collapsible.module.css';

export interface CollapsibleProps {
  /** Content to show/hide. */
  children: ReactNode;
  /** Whether the content is collapsed. Default: false (expanded). */
  collapsed?: boolean;
  /** Called when the collapsed state should change (controlled mode). */
  onCollapseChange?: (collapsed: boolean) => void;
}

/**
 * Collapsible — expands/collapses its content with a smooth height
 * transition. Use `collapsed` to control state and `onCollapseChange`
 * for controlled usage.
 */
export function Collapsible({
  children,
  collapsed = false,
  onCollapseChange,
}: CollapsibleProps): React.JSX.Element {
  return (
    <div
      className={[styles.collapsible, collapsed ? styles.collapsed : ''].filter(Boolean).join(' ')}
      data-state={collapsed ? 'collapsed' : 'expanded'}
      onClick={onCollapseChange ? () => onCollapseChange(!collapsed) : undefined}
    >
      <div className={styles.content}>{children}</div>
    </div>
  );
}
