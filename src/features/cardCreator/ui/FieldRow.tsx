/**
 * FieldRow — Card Creator field row: label + field-map select (which Anki
 * field this maps to) + input or textarea for the value.
 *
 * Per the mockup, each field has:
 *  - A label (e.g. "Target word", "Sentence")
 *  - A field-map select (which Anki field name this maps to, e.g. TargetWord)
 *  - An input (single line) or textarea (multi-line) for the value
 *
 * The field-map select lets users override the auto-mapped field. Options
 * come from the note type's actual fields (queried via modelFieldNames).
 */
import type { ReactElement, ReactNode } from 'react';
import { Select, type SelectOption } from '@/shared/ui/Select';
import styles from './FieldRow.module.css';

interface FieldRowProps {
  /** Human-readable label (e.g. "Target word"). */
  label: string;
  /** Anki field name this row is currently mapped to. When omitted, no
   *  field-map select is rendered (e.g. Tags row — tags aren't mapped to an
   *  Anki field, they're sent via the note's `tags` array). */
  mappedField?: string;
  /** Available Anki field names (from modelFieldNames) for the map select.
   *  Required when mappedField is provided. */
  availableFields?: readonly string[];
  /** Called when the user changes the field mapping. Required when mappedField
   *  is provided. */
  onMapChange?: (field: string) => void;
  /** The value input/textarea element. */
  children: ReactNode;
  /** Optional test id prefix. */
  testId?: string;
}

export function FieldRow({
  label,
  mappedField,
  availableFields,
  onMapChange,
  children,
  testId,
}: FieldRowProps): ReactElement {
  // ADR-026: prepend a "None" option (value '') so the user can opt out of
  // mapping a source field to any Anki field (e.g. don't send the screenshot
  // for this card). When mappedField is '' the select shows "None".
  const showMap = mappedField !== undefined && availableFields !== undefined && onMapChange !== undefined;
  const options: SelectOption[] = showMap
    ? [{ value: '', label: 'None' }, ...availableFields!.map((f) => ({ value: f, label: f }))]
    : [];
  return (
    <div className={styles.field} data-testid={testId ? `${testId}-row` : undefined}>
      <div className={styles.fieldHeader}>
        <label className={styles.fieldLabel}>{label}</label>
        {showMap && (
          <span className={styles.fieldMap}>
            <Select
              className={styles.fieldMapSelect}
              value={mappedField}
              options={options}
              onChange={onMapChange}
              aria-label={`Map ${label} to Anki field`}
              data-testid={testId ? `${testId}-map` : undefined}
            />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** Styled input matching the mockup's `.input` class. */
export function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return <input className={styles.input} {...props} />;
}

/** Styled textarea matching the mockup's `.textarea` class. */
export function FieldTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  return <textarea className={styles.textarea} {...props} />;
}
