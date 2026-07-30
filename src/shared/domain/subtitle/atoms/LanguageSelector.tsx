import type { ReactElement } from 'react';
import { Select } from '@/shared/ui';
import type { SelectOption } from '@/shared/ui/Select';
import styles from './LanguageSelector.module.css';

export interface LanguageOption {
  /** BCP-47 language tag, e.g. "en", "es", "ja". */
  srclang: string;
  /** Human-readable label, e.g. "English", "Spanish". */
  label: string;
}

export interface LanguageSelectorProps {
  /** Available languages to choose from. */
  languages: LanguageOption[];
  /** Currently selected srclang value (controlled). */
  value: string;
  /** Called when the user selects a different language. */
  onChange: (srclang: string) => void;
  /** Optional HTML id. */
  id?: string;
  /** Optional data-testid for testing. */
  dataTestId?: string;
  /** When true, the select is disabled. */
  disabled?: boolean;
}

/**
 * LanguageSelector — a styled dropdown for choosing a subtitle language.
 *
 * Wraps the generic `Select` atom (custom listbox with themed dropdown) so the
 * option list matches the Astryx design system instead of relying on the
 * OS-rendered native `<select>` popup. Controlled component with
 * `value`/`onChange` and `aria-label="Subtitle language"`.
 */
export function LanguageSelector({
  languages,
  value,
  onChange,
  id,
  dataTestId,
  disabled,
}: LanguageSelectorProps): ReactElement {
  const options: SelectOption[] = languages.map((lang) => ({
    value: lang.srclang,
    label: lang.label,
  }));

  return (
    <Select
      id={id}
      data-testid={dataTestId}
      className={styles.languageSelector}
      aria-label="Subtitle language"
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
