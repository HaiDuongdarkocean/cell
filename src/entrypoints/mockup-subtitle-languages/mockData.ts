import { SUBTITLE_LANGUAGES } from '@/shared/config/languageRegistry';
import type { MultiSelectOption } from '@/shared/ui/MultiSelect';

/** 'all' sentinel — mutually exclusive with specific languages. */
export const ALL_VALUE = 'all';

/** Specific languages only ('all' handled separately by each concept). */
export const LANGUAGE_OPTIONS: readonly MultiSelectOption[] =
  SUBTITLE_LANGUAGES.filter((o) => o.value !== ALL_VALUE);

/** Quick-pick set for Concept C's popular row. */
export const POPULAR_VALUES = ['en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de'];

export const isAll = (selected: string[]): boolean => selected.includes(ALL_VALUE);

export const labelOf = (value: string): string =>
  value === ALL_VALUE
    ? 'All languages'
    : (LANGUAGE_OPTIONS.find((o) => o.value === value)?.label ?? value);

/** Summary shown on collapsed triggers: "Tất cả" | "English" | "English +2". */
export const summaryLabel = (selected: string[]): string => {
  if (selected.length === 0) return 'None';
  if (isAll(selected)) return 'All languages';
  const first = labelOf(selected[0]);
  return selected.length > 1 ? `${first} +${selected.length - 1}` : first;
};

/** Exclusive-all toggle semantics shared by every concept. */
export const toggleValue = (selected: string[], value: string): string[] => {
  if (value === ALL_VALUE) return isAll(selected) ? [] : [ALL_VALUE];
  const without = selected.filter((v) => v !== value && v !== ALL_VALUE);
  return selected.includes(value) ? without : [...without, value];
};
