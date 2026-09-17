import type { MediaUpdateMode } from '../state/cardDraft';

export function splitTags(tags: string): string[] {
  return tags.split(/\s+/).filter(Boolean);
}

export function computeFieldUpdates(
  fields: Record<string, string>,
  existing: Record<string, string>,
  mode: MediaUpdateMode,
): Record<string, string> {
  const updates: Record<string, string> = {};
  for (const [ankiField, newValue] of Object.entries(fields)) {
    const existingValue = existing[ankiField] ?? '';
    if (mode === 'overwrite') {
      if (newValue) updates[ankiField] = newValue;
    } else if (mode === 'append') {
      if (newValue) {
        updates[ankiField] = existingValue ? `${existingValue}<br>${newValue}` : newValue;
      }
    } else {
      if (!existingValue && newValue) updates[ankiField] = newValue;
    }
  }
  return updates;
}
