import type { ReactElement, ReactNode } from 'react';
import { Heading } from './Heading';
import { Text } from './Text';
import styles from './SectionHeader.module.css';

export interface SectionHeaderProps {
  /** Section title (rendered as a Heading). */
  title: ReactNode;
  /** Optional muted line under the title. */
  subtitle?: ReactNode;
  /** Trailing action (button, menu trigger…). */
  action?: ReactNode;
  /** Semantic heading level. Default: 3. */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** data-cell-id for the header element. */
  'data-cell-id'?: string;
  className?: string;
}

/**
 * SectionHeader — canonical "title + subtitle + trailing action" header row
 * for sections inside panels. Do not re-roll `.sectionHeader` per feature.
 */
export function SectionHeader({
  title,
  subtitle,
  action,
  level = 3,
  'data-cell-id': dataCellId,
  className,
}: SectionHeaderProps): ReactElement {
  return (
    <div className={`${styles.header} ${className ?? ''}`} data-cell-id={dataCellId}>
      <div className={styles.text}>
        <Heading level={level} size={3} className={styles.title}>
          {title}
        </Heading>
        {subtitle && (
          <Text as="p" color="secondary" className={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </div>
      {action}
    </div>
  );
}
