import type { ReactNode } from 'react';
import styles from './SettingsPanel.module.css';

export interface SettingsPanelProps {
  children?: ReactNode;
  className?: string;
  'data-tihoka-id'?: string;
}

/**
 * SettingsPanel — sub-surface block inside a settings section body.
 * Children are sub-blocks (groups, coupled blocks) separated at the
 * nested-panel tier (space-3) — one ladder level below section body.
 */
export function SettingsPanel({ children, className, 'data-tihoka-id': dataTihokaId }: SettingsPanelProps): React.JSX.Element {
  const cls = [styles.panel, className ?? ''].filter(Boolean).join(' ');
  return <div className={cls} data-tihoka-id={dataTihokaId}>{children}</div>;
}
