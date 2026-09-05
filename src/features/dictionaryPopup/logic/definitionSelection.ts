// These used to live inside the legacy popupContent.ts renderer. They are
// still consumed by useCandidate and useDictionaryLookup, so they have been
// extracted into a standalone logic module before that legacy file was deleted.

import type { LookupResult, DefinitionEntry } from '../types';

/** Selection state for definitions (checkboxes). */
export type DefinitionSelection = Map<string, boolean>;

/** Initialize definition selection — empty until the user explicitly picks. */
export function initDefinitionSelection(result: LookupResult): DefinitionSelection {
  const map = new Map<string, boolean>();
  for (const def of result.definitions) {
    map.set(def.id, false);
  }
  return map;
}

/** Get the definitions the user explicitly selected. */
export function getSelectedDefinitions(
  result: LookupResult,
  selection: DefinitionSelection,
): DefinitionEntry[] {
  return result.definitions.filter((def) => selection.get(def.id) === true);
}
