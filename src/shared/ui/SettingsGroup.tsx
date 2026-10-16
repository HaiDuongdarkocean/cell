import type { ReactNode } from 'react';
import { Heading } from './Heading';
import { Text } from './Text';
import styles from './SettingsGroup.module.css';

export interface SettingsGroupProps {
  /** Sub-group label inside a section. Omit when the section title above
   *  already names the content and the group exists only to carry rows or
   *  a trailing action. */
  label?: ReactNode;
  /** Optional supporting line under the label. */
  description?: ReactNode;
  /** Trailing action (button, menu trigger…) aligned with the label. */
  action?: ReactNode;
  /** Grouped rows/controls. */
  children?: ReactNode;
  /** data-tihoka-id for the group element. */
  'data-tihoka-id'?: string;
  className?: string;
}

/**
 * SettingsGroup — the single sub-heading recipe inside a settings section:
 * a secondary label (with optional description + trailing action) above a
 * group of related rows.
 */
export function SettingsGroup({ label, description, action, children, 'data-tihoka-id': dataTihokaId, className }: SettingsGroupProps): React.JSX.Element {
  const cls = [styles.group, className ?? ''].filter(Boolean).join(' ');
  return (
    <div className={cls} role="group" aria-label={typeof label === 'string' ? label : undefined} data-tihoka-id={dataTihokaId}>
      {(label != null || action != null) && (
        <div className={styles.header}>
          {label != null && (
            <div className={styles.lead}>
              <Heading level={4} size={4} className={styles.heading}>
                {label}
              </Heading>
              {description && (
                <Text as="p" variant="supporting" color="secondary" className={styles.description}>
                  {description}
                </Text>
              )}
            </div>
          )}
          {action}
        </div>
      )}
      {children != null && <div className={styles.content}>{children}</div>}
    </div>
  );
}
