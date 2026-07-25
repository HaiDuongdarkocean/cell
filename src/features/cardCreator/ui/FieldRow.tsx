/**
 * FieldRow — Card Creator field row: label + field-map select (which Anki
 * field this maps to) + auto-grow input for the value.
 *
 * Per the mockup (docs/mockups/anki-card-mockup.html), each field has:
 *  - A label (e.g. "Target word", "Sentence")
 *  - A field-map select (which Anki field name this maps to, e.g. TargetWord)
 *  - An auto-grow input for the value (replaces both input + textarea)
 *
 * The auto-grow input:
 *  - Uses CSS `field-sizing: content` to grow vertically with content
 *    (JS fallback: rows attribute synced from value length for browsers
 *    without field-sizing support).
 *  - Has a clear (x) button on the right that empties the field in one click.
 *  - Uses the same surface background as the old textarea.
 *
 * The field-map select lets users override the auto-mapped field. Options
 * come from the note type's actual fields (queried via modelFieldNames).
 *
 * BEM blocks:
 *  - .field-row (this component's wrapper)
 *  - .field-input (the auto-grow input — also exported standalone)
 */
import { useRef, type ChangeEvent, type TextareaHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { Icon } from '@/shared/icons/Icon';
import styles from './FieldRow.module.css';

interface FieldRowProps {
  /** Human-readable label (e.g. "Target word"). */
  readonly label: string;
  /** Anki field name this row is currently mapped to. When omitted, no
   *  field-map select is rendered (e.g. Tags row — tags aren't mapped to an
   *  Anki field, they're sent via the note's `tags` array). */
  readonly mappedField?: string;
  /** Available Anki field names (from modelFieldNames) for the map select.
   *  Required when mappedField is provided. */
  readonly availableFields?: readonly string[];
  /** Called when the user changes the field mapping. Required when mappedField
   *  is provided. */
  readonly onMapChange?: (field: string) => void;
  /** The value input/textarea element. */
  readonly children: ReactNode;
  /** Optional data id — applied to the wrapper div as `<id>-row`. */
  readonly dataId?: string;
}

export function FieldRow({
  label,
  mappedField,
  availableFields,
  onMapChange,
  children,
  dataId,
}: FieldRowProps): ReactElement {
  // ADR-026: prepend a "None" option (value '') so the user can opt out of
  // mapping a source field to any Anki field (e.g. don't send the screenshot
  // for this card). When mappedField is '' the select shows "None".
  const showMap = mappedField !== undefined && availableFields !== undefined && onMapChange !== undefined;
  const options: SelectOption[] = showMap
    ? [{ value: '', label: 'None' }, ...availableFields!.map((f) => ({ value: f, label: f }))]
    : [];
  return (
    <div className={styles.fieldRow} data-testid={dataId ? `${dataId}-row` : undefined}>
      <div className={styles.fieldRow__header}>
        <label className={styles.fieldRow__label}>{label}</label>
        {showMap && (
          <span className={styles.fieldRow__map}>
            <Select
              className={styles.fieldRow__mapSelect}
              value={mappedField}
              options={options}
              onChange={onMapChange}
              aria-label={`Map ${label} to Anki field`}
              data-testid={dataId ? `${dataId}-map` : undefined}
              menuAlign="right"
            />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

interface FieldAutoGrowInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'size'> {
  /** Current value (controlled). */
  readonly value: string;
  /** Called with the new value when the input changes. */
  onChange: (value: string) => void;
  /** Called when the user clicks the clear (x) button. Default: sets value to ''. */
  readonly onClear?: () => void;
  /** Show the clear button. Default: true (shown whenever value is non-empty). */
  readonly clearable?: boolean;
  /** Optional data id — applied to the wrapper div as `<id>-input`. */
  readonly dataId?: string;
}

/**
 * FieldAutoGrowInput — auto-growing textarea with a clear (x) button.
 *
 * Always renders a `<textarea>` (not `<input>`) so text wraps and the field
 * grows vertically with content — both for multi-line (explicit \n) and for
 * single-line text that wraps at the field width.
 *  - `field-sizing: content` (CSS) grows the textarea to fit content.
 *  - JS fallback: when `field-sizing` is unsupported, a `rows` attribute is
 *    derived from the value's line count so the textarea still grows.
 *  - Clear button (x icon) sits top-right inside the box; one click empties.
 *  - Background matches the old textarea look (`--color-surface`).
 *
 * BEM block: `.field-input` (`.field-input__control`, `.field-input__clear`).
 */
export function FieldAutoGrowInput({
  value,
  onChange,
  onClear,
  clearable = true,
  dataId,
  className,
  ...rest
}: FieldAutoGrowInputProps): ReactElement {
  const controlRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(e.target.value);
  };

  const handleClear = (): void => {
    if (onClear) {
      onClear();
    } else {
      onChange('');
    }
    // Return focus to the textarea after clearing so the user can keep typing.
    controlRef.current?.focus();
  };

  // JS fallback for browsers without `field-sizing: content` support:
  // derive `rows` from line count so the textarea grows vertically.
  const lineCount = Math.max(1, value.split('\n').length);

  const controlClass = [styles.fieldInput__control, className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={styles.fieldInput} data-testid={dataId ? `${dataId}-input` : undefined}>
      <textarea
        ref={controlRef}
        className={controlClass}
        value={value}
        onChange={handleChange}
        rows={lineCount}
        {...rest}
      />
      {clearable && value.length > 0 && (
        <button
          type="button"
          className={styles.fieldInput__clear}
          aria-label="Clear"
          onClick={handleClear}
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}
