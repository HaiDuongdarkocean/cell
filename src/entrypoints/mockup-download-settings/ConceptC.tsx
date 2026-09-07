import { useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Collapsible } from '@/shared/ui/Collapsible';
import { SectionFrame, FieldRow, type PanelProps } from './common';
import {
  FIELD_DEFS,
  SETTING_GROUPS,
  SUMMARY_FIELDS,
  isFieldVisible,
  summaryValueLabel,
  fieldValueLabel,
} from './mockData';
import styles from './mockup.module.css';

/**
 * Concept C — Progressive Accordion.
 *
 * Groups are collapsed by default; clicking a group expands it. A sticky
 * summary bar at the top keeps the key current choices visible at all times.
 * The advanced child (Workers) stays hidden inside the Conversion group until
 * Parallel conversion is set to Manual. Minimal cognitive load.
 */
export function ConceptC({ settings, onChange }: PanelProps): React.ReactElement {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string): void => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SectionFrame noClip>
      <div className={styles.mksSummaryBar} aria-label="Current download choices">
        {SUMMARY_FIELDS.map((field) => (
          <span key={field} className={styles.mksSummaryChip}>
            <span className={styles.mksSummaryKey}>{FIELD_DEFS[field].shortLabel}</span>
            {summaryValueLabel(field, settings)}
          </span>
        ))}
      </div>
      <div className={styles.mksAccList}>
        {SETTING_GROUPS.map((group) => {
          const expanded = Boolean(open[group.id]);
          const visibleFields = group.fields.filter((field) =>
            isFieldVisible(field, settings),
          );
          return (
            <div key={group.id} className={styles.mksAccGroup}>
              <button
                type="button"
                className={styles.mksAccHeader}
                aria-expanded={expanded}
                aria-controls={`mks-acc-${group.id}`}
                onClick={() => toggle(group.id)}
              >
                <span className={styles.mksAccTitle}>{group.label}</span>
                <span className={styles.mksAccMeta}>
                  {visibleFields
                    .map((field) => fieldValueLabel(field, settings))
                    .join(' · ')}
                </span>
                <Icon
                  name="chevronDown"
                  size="sm"
                  className={
                    expanded ? styles.mksAccChevronOpen : styles.mksAccChevron
                  }
                />
              </button>
              <Collapsible collapsed={!expanded}>
                <div className={styles.mksAccBody} id={`mks-acc-${group.id}`}>
                  {visibleFields.map((field, index) => (
                    <FieldRow
                      key={field}
                      field={field}
                      settings={settings}
                      onChange={onChange}
                      idPrefix={`mks-c-${group.id}`}
                      stacked
                      divider={index > 0}
                      className={
                        field === 'manualWorkerCount' ? styles.mksChildField : undefined
                      }
                    />
                  ))}
                </div>
              </Collapsible>
            </div>
          );
        })}
      </div>
    </SectionFrame>
  );
}
