import type { SelectOption } from '@/shared/ui/Select';

export const TRIGGER_OPTIONS: SelectOption[] = [
  { value: 'click', label: 'Click' },
  { value: 'hover', label: 'Hover' },
  { value: 'hover-ctrl', label: 'Hover + Ctrl' },
  { value: 'hover-shift', label: 'Hover + Shift' },
  { value: 'hover-alt', label: 'Hover + Alt' },
];

export const TAB_OPTIONS: SelectOption[] = [
  { value: '', label: 'Dictionary' },
  { value: 'audio', label: 'Audio' },
  { value: 'image', label: 'Image' },
  { value: 'translate', label: 'Translate' },
  { value: 'links', label: 'Links' },
  { value: 'pronunciation', label: 'Sounds' },
];

export const SRS_OPTIONS: SelectOption[] = [
  { value: 'anki', label: 'Anki' },
  { value: 'ocean-srs', label: 'Ocean SRS' },
];
