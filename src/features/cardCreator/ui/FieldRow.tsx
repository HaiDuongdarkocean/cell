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
import { useRef, useState, type ChangeEvent, type KeyboardEvent, type TextareaHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { Label } from '@/shared/ui/Label';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import styles from './FieldRow.module.css';

interface FieldRowProps {
  /** Human-readable label (e.g. "Target word"). */
  readonly label: string;
  /** The value input/textarea element. */
  readonly children: ReactNode;
  /** Optional trailing action(s) rendered in the header next to the label. */
  readonly trailing?: ReactNode;
  /** Optional data id — applied to the wrapper div as `<id>-row`. */
  readonly dataId?: string;
}

export function FieldRow({
  label,
  children,
  trailing,
  dataId,
}: FieldRowProps): ReactElement {
  return (
    <div className={styles.fieldRow} data-cell-id={dataId ? `${dataId}-row` : undefined}>
      <div className={styles.fieldRow__header}>
        <Label className={styles.fieldRow__label}>{label}</Label>
        {trailing && (
          <div className={styles.fieldRow__actions}>
            {trailing}
          </div>
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

  const clearLabel = t('ui.searchField.clear');
  const controlClass = [styles.fieldInput__control, className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={styles.fieldInput} data-cell-id={dataId ? `${dataId}-input` : undefined}>
      <textarea
        ref={controlRef}
        className={controlClass}
        value={value}
        onChange={handleChange}
        rows={lineCount}
        {...rest}
      />
      {clearable && value.length > 0 && (
        <Button
          size="sm"
          shape="circle"
          variant="ghost"
          className={styles.fieldInput__clear}
          aria-label={clearLabel}
          onClick={handleClear}
        >
          <Icon name="x" size="sm" />
        </Button>
      )}
    </div>
  );
}

interface TagInputProps {
  /** Current tags as a whitespace-separated string. */
  readonly value: string;
  /** Called with the updated whitespace-separated string. */
  readonly onChange: (value: string) => void;
  /** Placeholder shown when no tags exist. */
  readonly placeholder?: string;
  /** Accessible label for the tag input. */
  readonly ariaLabel?: string;
  /** Optional data id — applied to the wrapper. */
  readonly dataId?: string;
}

/** TagInput — chip-based tag entry with inline add/remove. */
export function TagInput({
  value,
  onChange,
  placeholder = t('cardCreator.tagInput.placeholder'),
  ariaLabel,
  dataId,
}: TagInputProps): ReactElement {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tags = value.split(/\s+/).filter(Boolean);

  const commit = (raw: string): void => {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return;
    const next = [...new Set([...tags, ...parts])];
    onChange(next.join(' '));
    setInput('');
  };

  const removeTag = (index: number): void => {
    const next = [...tags];
    next.splice(index, 1);
    onChange(next.join(' '));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      commit(input);
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleBlur = (): void => {
    if (input.trim()) {
      commit(input);
    }
  };

  return (
    <div
      className={styles.tagInput}
      data-cell-id={dataId ? `${dataId}-input` : undefined}
    >
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className={styles.tagInput__chip}
          data-cell-id={dataId ? `${dataId}-chip-${index}` : undefined}
        >
          <span className={styles.tagInput__label}>{tag}</span>
          <Button
            size="sm"
            shape="circle"
            variant="ghost"
            aria-label={t('cardCreator.media.remove', [tag])}
            onClick={() => removeTag(index)}
            className={styles.tagInput__remove}
            data-cell-id={dataId ? `${dataId}-remove-${index}` : undefined}
          >
            <Icon name="x" size="sm" />
          </Button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className={styles.tagInput__field}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={tags.length === 0 ? placeholder : ''}
        aria-label={ariaLabel}
      />
    </div>
  );
}
