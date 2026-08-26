import { Select } from '@/shared/ui';
import type { PresetName } from '@/entities/theme';

interface PresetSwitcherProps {
  /** Selected preset, or undefined for custom. */
  value?: PresetName | undefined;
  /** Called when selection changes; undefined means "Custom". */
  onChange: (preset: PresetName | undefined) => void;
  /** Optional test id. */
  'data-cell-id'?: string;
}

const OPTIONS = [
  { value: '', label: 'Custom' },
  { value: 'dawn', label: 'Dawn' },
  { value: 'forest', label: 'Forest' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'warmth', label: 'Warmth' },
];

/** Preset switcher — choose a Liquid Glass palette or fall back to custom colors. */
export function PresetSwitcher({ value, onChange, 'data-cell-id': dataCellId }: PresetSwitcherProps): React.JSX.Element {
  return (
    <Select
      value={value ?? ''}
      options={OPTIONS}
      onChange={(next) => onChange(next ? (next as PresetName) : undefined)}
      aria-label="Color preset"
      data-cell-id={dataCellId}
    />
  );
}
