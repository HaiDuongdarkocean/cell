import { t, type MessageKey } from '@/shared/i18n';
import { Select } from '@/shared/ui';
import type { PresetName } from '@/entities/theme';

interface PresetSwitcherProps {
  /** Selected preset. */
  value: PresetName;
  /** Called when selection changes. */
  onChange: (preset: PresetName) => void;
  /** Optional test id. */
  'data-cell-id'?: string;
}

const OPTIONS: ReadonlyArray<{ value: PresetName; label: MessageKey }> = [
  { value: 'dawn', label: 'theme.preset.dawn' },
  { value: 'forest', label: 'theme.preset.forest' },
  { value: 'ocean', label: 'theme.preset.ocean' },
  { value: 'warmth', label: 'theme.preset.warmth' },
];

/** Preset switcher — choose a Liquid Glass palette. */
export function PresetSwitcher({ value, onChange, 'data-cell-id': dataCellId }: PresetSwitcherProps): React.JSX.Element {
  return (
    <Select
      value={value}
      options={OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
      onChange={(next) => onChange(next as PresetName)}
      aria-label={t('theme.preset.aria')}
      data-cell-id={dataCellId}
    />
  );
}
