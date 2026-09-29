import type { ClickModifierState, TriggerMode } from './popupTypes';

export const TRIGGER_MODIFIER_KEY: Partial<Record<TriggerMode, 'Control' | 'Shift' | 'Alt'>> = {
  'hover-ctrl': 'Control',
  'hover-shift': 'Shift',
  'hover-alt': 'Alt',
};

export function modifierMatches(mode: TriggerMode, e: ClickModifierState): boolean {
  switch (mode) {
    case 'hover-ctrl': return e.ctrlKey;
    case 'hover-shift': return e.shiftKey;
    case 'hover-alt': return e.altKey;
    default: return true;
  }
}
