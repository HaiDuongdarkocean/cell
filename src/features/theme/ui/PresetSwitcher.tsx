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

const OPTIONS = [
  { value: 'dawn', label: 'Dawn' },
  { value: 'forest', label: 'Forest' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'warmth', label: 'Warmth' },
];

/** Preset switcher — choose a Liquid Glass palette. */
export function PresetSwitcher({ value, onChange, 'data-cell-id': dataCellId }: PresetSwitcherProps): React.JSX.Element {
  return (
    <Select
      value={value}
      options={OPTIONS}
      onChange={(next) => onChange(next as PresetName)}
      aria-label="Color preset"
      data-cell-id={dataCellId}
    />
  );
}
