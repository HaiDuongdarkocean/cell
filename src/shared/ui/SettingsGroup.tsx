import type { ReactNode } from 'react';
import { Text } from './Text';
import styles from './SettingsGroup.module.css';

export interface SettingsGroupProps {
  /** Sub-group label inside a section. */
  label: ReactNode;
  /** Optional supporting line under the label. */
  description?: ReactNode;
  /** Trailing action (button, menu trigger…) aligned with the label. */
  action?: ReactNode;
  /** Grouped rows/controls. */
  children?: ReactNode;
  /** data-cell-id for the group element. */
  'data-cell-id'?: string;
  className?: string;
}

/**
 * SettingsGroup — the single sub-heading recipe inside a settings section:
 * a secondary label (with optional description + trailing action) above a
 * group of related rows.
 */
export function SettingsGroup({ label, description, action, children, 'data-cell-id': dataCellId, className }: SettingsGroupProps): React.JSX.Element {
  const cls = [styles.group, className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={cls} role="group" aria-label={typeof label === 'string' ? label : undefined} data-cell-id={dataCellId}>
      <div className={styles.header}>
        <div className={styles.lead}>
          <Text as="div" variant="label" color="secondary" className={styles.label}>
            {label}
          </Text>
          {description && (
            <Text as="p" variant="supporting" color="secondary" className={styles.description}>
              {description}
            </Text>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
