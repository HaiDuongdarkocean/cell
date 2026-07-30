import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import styles from './Portal.module.css';

export interface PortalProps {
  /** Content to render into the portal target. */
  children: ReactNode;
  /** Target container. Defaults to document.body. */
  container?: HTMLElement | null;
}

/**
 * Portal — renders children into document.body (or a custom container) via
 * React's `createPortal`. Useful for overlays, tooltips, and dialogs that
 * must escape parent stacking contexts.
 */
export function Portal({ children, container }: PortalProps): React.JSX.Element | null {
  const target = container ?? (typeof document !== 'undefined' ? document.body : null);
  if (!target) return null;

  return createPortal(<div className={styles.portal}>{children}</div>, target);
}
