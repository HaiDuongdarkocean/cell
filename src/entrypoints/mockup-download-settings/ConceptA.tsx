import { Heading, Text } from '@/shared/ui';
import { FieldRow, type PanelProps } from './common';
import { SETTING_GROUPS, isFieldVisible } from './mockData';
import styles from './mockup.module.css';

/**
 * Concept A — Proximity Groups.
 *
 * The same grouped layout as the glass concept, but each section is defined
 * only by whitespace and the small uppercase group title. No cards, no
 * borders, no glass. The Format & Quality pair still goes 2-column on wide
 * containers. Plain, calm, and the simplest to ship.
 */
export function ConceptA({ settings, onChange }: PanelProps): React.ReactElement {
  return (
    <div className={styles.mksAFrame}>
      <div className={styles.mksAHeader}>
        <Heading level={4} size={4} className={styles.mksATitle}>Download</Heading>
        <Text as="p" color="secondary" className={styles.mksADesc}>
          Download format, quality, concurrency, conversion, and filename options.
        </Text>
      </div>

      <div className={styles.mksAGroupList}>
        {SETTING_GROUPS.map((group) => (
          <section key={group.id} className={styles.mksAGroup}>
            <div className={styles.mksAGroupTitle}>{group.label}</div>
            <div className={group.id === 'format' ? styles.mksPairGrid : styles.mksFieldColumn}>
              {group.fields
                .filter((field) => isFieldVisible(field, settings))
                .map((field) => (
                  <FieldRow
                    key={field}
                    field={field}
                    settings={settings}
                    onChange={onChange}
                    idPrefix={`mks-a-${group.id}`}
                    stacked
                    className={field === 'manualWorkerCount' ? styles.mksAChildField : undefined}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
