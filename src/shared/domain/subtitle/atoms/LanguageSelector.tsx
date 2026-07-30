import type { ReactElement } from 'react';
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
 * LanguageSelector — a native `<select>` dropdown for choosing a subtitle
 * language. Controlled component with `value`/`onChange` and
 * `aria-label="Subtitle language"`.
 */
export function LanguageSelector({
  languages,
  value,
  onChange,
  id,
  dataTestId,
  disabled,
}: LanguageSelectorProps): ReactElement {
  return (
    <select
      id={id}
      data-testid={dataTestId}
      className={styles.languageSelector}
      aria-label="Subtitle language"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {languages.map((lang) => (
        <option key={lang.srclang} value={lang.srclang}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
